import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import type { TokenPair } from './token';
import { AuthService } from './auth.service';
import {
  acceptInvitationSchema,
  changePasswordSchema,
  forcedPasswordChangeSchema,
  forgotPasswordSchema,
  inviteUserSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  validateResetPasswordOtpSchema,
} from './dtos';
import { changePasswordDataSchema, loginDataSchema, userResponseSchema } from './response';
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
import type { DataResponseDto, LoginDataDto, MessageResponseDto, UserResponseDto } from './response';
import { AllowedRoles, BaseResponseSchema, CurrentSession, CurrentUser, Public, idParamSchema } from '@common';
import type { IdParam, RequestSession } from '@common';
import { UserRole } from '@common/enums';
import type { UserDocument } from '@modules/users/user.model';


const messageResponse = BaseResponseSchema();

/** Per client IP, on routes that check a secret or send an email. Overrides the global THROTTLE_* limit. */
const STRICT_THROTTLE = { default: { limit: 5, ttl: minutes(1) } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @AllowedRoles([UserRole.SUPER_ADMIN])
  @ApiOperation({ summary: 'User invitation' })
  @ApiResponse({ status: 201, description: 'User invited successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @Post('invite')
  inviteUser(@Body({ schema: inviteUserSchema }) userData: InviteUserDto): Promise<MessageResponseDto> {
    return this.authService.inviteUser(userData);
  }

  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'When `passwordChangeRequired` is true, no tokens are issued: call POST /auth/forced-change-password with `passwordChangeToken`, then log in again.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(loginDataSchema) })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account is not active' })
  @ApiResponse({ status: 429, description: 'Too many requests from this client' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('login')
  login(@Body({ schema: loginSchema }) loginDto: LoginDto): Promise<DataResponseDto<LoginDataDto>> {
    return this.authService.login(loginDto);
  }

  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description: 'The refresh token is single use. Reusing one revokes its whole session.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(changePasswordDataSchema) })
  @ApiResponse({ status: 401, description: 'Refresh token is invalid, expired or already used' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body({ schema: refreshTokenSchema }) refreshTokenDto: RefreshTokenDto): Promise<DataResponseDto<{ tokens: TokenPair }>> {
    return this.authService.refresh(refreshTokenDto);
  }

  @ApiOperation({ summary: 'Set a new password after a login that returned passwordChangeRequired' })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('forced-change-password')
  completeForcedPasswordChange(@Body({ schema: forcedPasswordChangeSchema }) dto: ForcedPasswordChangeDto): Promise<MessageResponseDto> {
    return this.authService.completeForcedPasswordChange(dto);
  }

  @ApiOperation({ summary: 'Activate an invited account by setting its password' })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'No pending invitation for this user' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('accept-invitation')
  acceptInvitation(@Body({ schema: acceptInvitationSchema }) dto: AcceptInvitationDto): Promise<MessageResponseDto> {
    return this.authService.acceptInvitation(dto);
  }

  @ApiOperation({ summary: 'Email a password reset link', description: 'Always returns 200, whether or not the account exists.' })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 429, description: 'Too many requests from this client' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('forgot-password')
  forgotPassword(@Body({ schema: forgotPasswordSchema }) dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Set a new password using the token from a reset email', description: 'Ends every existing session of the user.' })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('reset-password')
  resetPassword(@Body({ schema: resetPasswordSchema }) dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({ summary: 'Validate a password reset OTP', description: 'Checks if the provided OTP is valid and not expired.' })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('reset-password/validate')
  validateResetPasswordOtp(@Body({ schema: validateResetPasswordOtpSchema }) dto: ValidateResetPasswordOtpDto): Promise<MessageResponseDto> {
    return this.authService.validateResetPasswordOtp(dto);
  }

  @ApiOperation({
    summary: 'Change the logged in user password',
    description: 'Ends every other session and returns a new token pair. Super admins must also send `otp`.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(changePasswordDataSchema) })
  @ApiResponse({ status: 403, description: 'Current password is incorrect, or OTP missing/invalid' })
  @Throttle(STRICT_THROTTLE)
  @Patch('change-password')
  changePassword(@Body({ schema: changePasswordSchema }) dto: ChangePasswordDto, @CurrentUser('id') userId: string) {
    return this.authService.changePassword(dto, userId);
  }

  @ApiOperation({ summary: 'Log out of the current session' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentSession() session: RequestSession): Promise<void> {
    return this.authService.logout(session);
  }

  @ApiOperation({ summary: 'Log a user out of every device. Requires super admin role.' })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 404, description: 'User not found' })
  @AllowedRoles([UserRole.SUPER_ADMIN])
  @Delete('users/:id/sessions')
  revokeUserSessions(@Param({ schema: idParamSchema }) { id }: IdParam): Promise<MessageResponseDto> {
    return this.authService.revokeUserSessions(id);
  }

  @ApiOperation({ summary: 'Return the logged in user' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(userResponseSchema) })
  @Get('me')
  getCurrentUser(@CurrentUser() user: UserDocument): DataResponseDto<UserResponseDto> {
    return this.authService.getCurrentUser(user);
  }
}
