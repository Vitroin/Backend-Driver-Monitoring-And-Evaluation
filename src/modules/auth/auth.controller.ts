import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  acceptInvitationSchema,
  changePasswordSchema,
  forcedPasswordChangeSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema,
} from './dtos';
import {
  changePasswordDataSchema,
  forcedPasswordChangeDataSchema,
  loginDataSchema,
  tokensDataSchema,
  userResponseSchema,
} from './response';
import type {
  ChangePasswordDataDto,
  ForcedPasswordChangeDataDto,
  LoginDataDto,
  TokensDataDto,
  UserResponseDto,
} from './response';
import type {
  AcceptInvitationDto,
  ChangePasswordDto,
  ForcedPasswordChangeDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dtos';
import { AllowedRoles, BaseResponseSchema, CurrentSession, CurrentUser, Public, idParamSchema } from '@common';
import type { DataResponseDto, IdParam, MessageResponseDto, RequestSession } from '@common';
import { UserRole } from '@common/enums';
import type { UserDocument } from '@modules/users/user.model';

const messageResponse = BaseResponseSchema();

/** Per client IP, on routes that check a secret or send an email. Overrides the global THROTTLE_* limit. */
const STRICT_THROTTLE = { default: { limit: 5, ttl: minutes(1) } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Log in with username and password',
    description:
      'When `passwordChangeRequired` is true, no tokens are issued: call POST /auth/forced-change-password with `passwordChangeToken`, which logs the user in.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(loginDataSchema) })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account is not active' })
  @ApiResponse({ status: 429, description: 'Too many requests from this client' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('login')
  async login(@Body({ schema: loginSchema }) loginDto: LoginDto): Promise<DataResponseDto<LoginDataDto>> {
    const data = await this.authService.login(loginDto);
    return { message: data.passwordChangeRequired ? 'Password change required' : 'Login successful', data };
  }

  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description: 'The refresh token is single use: a token that was already exchanged is rejected with 401.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tokensDataSchema) })
  @ApiResponse({ status: 401, description: 'Refresh token is invalid, expired or already used' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body({ schema: refreshTokenSchema }) refreshTokenDto: RefreshTokenDto): Promise<DataResponseDto<TokensDataDto>> {
    return { message: 'Tokens refreshed successfully', data: { tokens: await this.authService.refresh(refreshTokenDto) } };
  }

  @ApiOperation({
    summary: 'Set a new password after a login that returned passwordChangeRequired',
    description: 'Logs the user in: returns a token pair and the user, like a successful login.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(forcedPasswordChangeDataSchema) })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('forced-change-password')
  async completeForcedPasswordChange(
    @Body({ schema: forcedPasswordChangeSchema }) dto: ForcedPasswordChangeDto,
  ): Promise<DataResponseDto<ForcedPasswordChangeDataDto>> {
    return { message: 'Password changed successfully', data: await this.authService.completeForcedPasswordChange(dto) };
  }

  @ApiOperation({ summary: 'Activate an invited account by setting its password' })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'No pending invitation for this user' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('accept-invitation')
  async acceptInvitation(@Body({ schema: acceptInvitationSchema }) dto: AcceptInvitationDto): Promise<MessageResponseDto> {
    await this.authService.acceptInvitation(dto);
    return { message: 'Account activated successfully. You can now login with your new password.' };
  }

  @ApiOperation({
    summary: 'Email a password reset code',
    description: 'Always returns 200, whether or not the account exists. A new code can be requested once a minute.',
  })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 429, description: 'Too many requests from this client' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('forgot-password')
  async forgotPassword(@Body({ schema: forgotPasswordSchema }) dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    await this.authService.forgotPassword(dto);
    return { message: 'If an account exists for this username, a password reset code has been sent to its email.' };
  }

  @ApiOperation({
    summary: 'Set a new password using the emailed reset code',
    description: 'The code works once. Ends every existing session of the user.',
  })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Post('reset-password')
  async resetPassword(@Body({ schema: resetPasswordSchema }) dto: ResetPasswordDto): Promise<MessageResponseDto> {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successfully. You can now login with your new password.' };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change the logged in user password',
    description:
      'Ends every other session and returns a new token pair. Super admins call it twice: without `otp` (an OTP is emailed and `otpRequired` is true), then with it.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(changePasswordDataSchema) })
  @ApiResponse({ status: 403, description: 'Current password is incorrect, or OTP invalid' })
  @ApiResponse({ status: 429, description: 'An OTP was already sent less than a minute ago' })
  @Throttle(STRICT_THROTTLE)
  @Patch('change-password')
  async changePassword(
    @Body({ schema: changePasswordSchema }) dto: ChangePasswordDto,
    @CurrentUser('id') userId: string,
  ): Promise<DataResponseDto<ChangePasswordDataDto>> {
    const data = await this.authService.changePassword(dto, userId);
    return { message: data.otpRequired ? 'OTP sent to your registered email' : 'Password changed successfully', data };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out of the current session' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentSession() session: RequestSession): Promise<void> {
    return this.authService.logout(session);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log a user out of every device. Requires super admin role.' })
  @ApiResponse({ status: 200, standardSchema: messageResponse })
  @ApiResponse({ status: 404, description: 'User not found' })
  @AllowedRoles([UserRole.SUPER_ADMIN])
  @Delete('users/:id/sessions')
  async revokeUserSessions(@Param({ schema: idParamSchema }) { id }: IdParam): Promise<MessageResponseDto> {
    await this.authService.revokeUserSessions(id);
    return { message: 'User logged out from all devices successfully' };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the logged in user' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(userResponseSchema) })
  @Get('me')
  getCurrentUser(@CurrentUser() user: UserDocument): DataResponseDto<UserResponseDto> {
    return { message: 'Current user information retrieved successfully', data: this.authService.getCurrentUser(user) };
  }
}
