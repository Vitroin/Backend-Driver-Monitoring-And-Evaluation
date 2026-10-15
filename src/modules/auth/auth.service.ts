import { ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { mongo } from 'mongoose';
import type { DataResponseDto, MessageResponseDto, RequestSession } from '@common';
import { UserRole, UserStatus } from '@common/enums';
import { UsersService } from '@modules/users/users.service';
import type { UserDocument } from '@modules/users/user.model';
import { TransactionService } from '@shared/modules/transactions/transactions.service';
import { OneTimeTokenPurpose, TokenService } from './token';
import type { TokenPair } from './token';
import { HashingService } from './hashing';
import { OtpPurpose, OtpService } from './otp';
import { AuthFactory } from './auth.factory';
import { AuthMailService } from './auth-mail.service';
import type {
  AcceptInvitationDto,
  ChangePasswordDto,
  ForcedPasswordChangeDto,
  ForgotPasswordDto,
  InviteUserDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  ValidateResetPasswordOtpDto,
} from './dtos';
import { LoginDataDto, UserResponseDto } from './response';

const INVALID_OTP = 'Invalid or expired OTP. Please request a new password reset OTP.';

@Injectable()
export class AuthService implements OnModuleInit {
  /** Compared against when the username doesn't exist, so a login takes the same time either way. */
  private dummyPasswordHash!: string;

  constructor(
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
    private readonly hashingService: HashingService,
    private readonly otpService: OtpService,
    private readonly transactions: TransactionService,
    private readonly authFactory: AuthFactory,
    private readonly authMailService: AuthMailService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await this.hashingService.hashPassword(crypto.randomUUID());
  }

  async login(loginDto: LoginDto): Promise<DataResponseDto<LoginDataDto>> {
    const user = await this.usersService.findByUsername(loginDto.username);
    const isPasswordValid = await this.hashingService.verifyPassword(user?.passwordHash ?? this.dummyPasswordHash, loginDto.password);
    if (!user || !isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('Please contact system administrator');

    if (user.mustChangePassword) {
      const passwordChangeToken = await this.tokenService.issueOneTimeToken(OneTimeTokenPurpose.FORCED_PASSWORD_CHANGE, user.id);
      return { message: 'Password change required', data: { passwordChangeRequired: true, passwordChangeToken } };
    }

    const tokens = await this.tokenService.issueTokens(user.id, user.securityStamp.toString());
    return { message: 'Login successful', data: { passwordChangeRequired: false, tokens, user: this.authFactory.toUserResponse(user) } };
  }

  /** Exchanges a refresh token for a new token pair. The presented refresh token can't be used again. */
  async refresh(refreshTokenDto: RefreshTokenDto): Promise<DataResponseDto<{ tokens: TokenPair }>> {
    const session = await this.tokenService.findRefreshSession(refreshTokenDto.refreshToken);

    const user = await this.usersService.findForAuthentication(session.userId);
    if (!user || !user.securityStamp.equals(session.securityStamp) || user.status !== UserStatus.ACTIVE || user.mustChangePassword) {
      await this.tokenService.revokeRefreshSession(session.id);
      throw new UnauthorizedException('Refresh token is invalid. Please login again');
    }

    const tokens = await this.tokenService.rotateRefreshToken(session);
    return { message: 'Tokens refreshed successfully', data: { tokens } };
  }

  /** Sets the password of a user who logged in with `mustChangePassword`, using the token login returned. */
  async completeForcedPasswordChange(dto: ForcedPasswordChangeDto): Promise<DataResponseDto<{ tokens: TokenPair; user: UserResponseDto }>> {
    const userId = await this.tokenService.consumeOneTimeToken(OneTimeTokenPurpose.FORCED_PASSWORD_CHANGE, dto.token);
    await this.replacePassword(userId, dto.newPassword);

    // Read the user again: replacePassword rotated the security stamp and cleared mustChangePassword
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const tokens = await this.tokenService.issueTokens(user.id, user.securityStamp.toString());
    return {
      message: 'Password changed successfully.',
      data: { tokens, user: this.authFactory.toUserResponse(user) },
    };
  }

  /** Changes the signed-in user's password, ends all their sessions, and starts a new one. */
  async changePassword(dto: ChangePasswordDto, userId: string) {
    const user = await this.usersService.findWithCredentialsById(userId);
    if (!user) throw new UnauthorizedException('Invalid token. Please login again');

    const isCurrentPasswordValid = await this.hashingService.verifyPassword(user.passwordHash, dto.currentPassword);
    if (!isCurrentPasswordValid) throw new ForbiddenException('Current password is incorrect');

    if (user.role === UserRole.SUPER_ADMIN) {
      // First call without an OTP: send one and stop here
      if (!dto.otp) return this.requestChangePasswordOtp(user);
      // Second call with the OTP: verify it
      const isOtpValid = await this.otpService.verify(OtpPurpose.SUPER_ADMIN_CHANGE_PASSWORD, user.id, dto.otp);
      if (!isOtpValid) throw new ForbiddenException('Invalid or expired OTP');
    }

    const passwordHash = await this.hashingService.hashPassword(dto.newPassword);

    const tokens = await this.transactions.run(async () => {
      const securityStamp = await this.usersService.changePassword(user.id, passwordHash);
      await this.tokenService.revokeAllRefreshTokens(user.id);
      return this.tokenService.issueTokens(user.id, securityStamp);
    });
    return { message: 'Password changed successfully', data: { tokens } };
  }

  /** Creates the user with a random unusable password and emails them a link to set their own. */
  async inviteUser(inviteUserDto: InviteUserDto): Promise<MessageResponseDto> {
    const passwordHash = await this.hashingService.hashPassword(crypto.randomUUID());

    let user: UserDocument;
    try {
      user = await this.usersService.createUser(inviteUserDto, passwordHash);
    } catch (error) {
      if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) throw error;
      const field = error.keyPattern?.username ? 'Username' : 'Email';
      throw new ConflictException(`${field} already exists`);
    }

    await this.sendInvitationEmail(user);
    return { message: 'User invited successfully' };
  }

  async acceptInvitation(dto: AcceptInvitationDto): Promise<MessageResponseDto> {
    const userId = await this.tokenService.consumeOneTimeToken(OneTimeTokenPurpose.ACCOUNT_ACTIVATION, dto.token);
    const passwordHash = await this.hashingService.hashPassword(dto.password);
    await this.usersService.activate(userId, passwordHash);
    return { message: 'Account activated successfully. You can now login with your new password.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const user = await this.usersService.findByUsername(dto.username);
    if (user?.status === UserStatus.ACTIVE) {
      const otp = await this.otpService.issue(OtpPurpose.RESET_PASSWORD, user.id);
      await this.authMailService.sendResetPasswordEmail(user.email, otp);
    }
    return { message: 'If an account exists for this username, a password reset code has been sent to its email.' };
  }

  async validateResetPasswordOtp(dto: ValidateResetPasswordOtpDto): Promise<MessageResponseDto> {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException(INVALID_OTP);

    const isOtpValid = await this.otpService.verify(OtpPurpose.RESET_PASSWORD, user.id, dto.otp);
    if (!isOtpValid) throw new UnauthorizedException(INVALID_OTP);
    return { message: 'OTP is valid.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException(INVALID_OTP);

    const isOtpValid = await this.otpService.verify(OtpPurpose.RESET_PASSWORD, user.id, dto.otp);
    if (!isOtpValid) throw new UnauthorizedException(INVALID_OTP);

    await this.replacePassword(user.id, dto.newPassword);
    return { message: 'Password reset successfully. You can now login with your new password.' };
  }

  /** Ends the session the request was made with. */
  async logout(session: RequestSession): Promise<void> {
    await this.tokenService.revokeSession(session.sid, session.exp);
  }

  /** Ends every session of a user: rotating the stamp kills their access tokens, and their refresh tokens are deleted. */
  async revokeUserSessions(userId: string): Promise<MessageResponseDto> {
    await this.transactions.run(async () => {
      await this.usersService.rotateSecurityStamp(userId);
      await this.tokenService.revokeAllRefreshTokens(userId);
    });
    return { message: 'User logged out from all devices successfully' };
  }

  getCurrentUser(user: UserDocument): DataResponseDto<UserResponseDto> {
    return { message: 'Current user information retrieved successfully', data: this.authFactory.toUserResponse(user) };
  }

  /** Sends a super admin the OTP that `changePassword` requires from them. */
  private async requestChangePasswordOtp(user: UserDocument) {
    const otp = await this.otpService.issue(OtpPurpose.SUPER_ADMIN_CHANGE_PASSWORD, user.id);
    await this.authMailService.sendChangePasswordEmail(user.email, otp);
    return { message: 'OTP sent to your registered email', otpRequired: true };
  }

  /** Emails an invited user a single-use link to set their password and activate their account. */
  private async sendInvitationEmail(user: UserDocument): Promise<void> {
    if (user.status !== UserStatus.WAITING_FOR_ACTIVATION) {
      throw new ForbiddenException('Only invited users can be sent an activation email');
    }
    const token = await this.tokenService.issueOneTimeToken(OneTimeTokenPurpose.ACCOUNT_ACTIVATION, user.id);
    await this.authMailService.sendInvitationEmail(user.email, token);
  }

  /** Sets a new password and ends every existing session, in one transaction. */
  private async replacePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hashingService.hashPassword(newPassword);
    await this.transactions.run(async () => {
      await this.usersService.changePassword(userId, passwordHash);
      await this.tokenService.revokeAllRefreshTokens(userId);
    });
  }
}