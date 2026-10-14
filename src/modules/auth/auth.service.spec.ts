import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Config } from '@config';
import { UserRole, UserStatus } from '@common/enums';
import { MailService } from '@core/mail';
import { TransactionService } from '@shared/transactions';
import { UsersService } from '@modules/users';
import { AuthService } from './auth.service';
import { AuthFactory } from './auth.factory';
import { TokenService, OneTimeTokenPurpose } from './token';
import { HashingService } from './hashing';
import { OtpService } from './otp';
import { buildUser } from '../../../test/factories/user.factory';

describe('AuthService', () => {
  let service: AuthService;

  const tokenService = {
    issueTokens: vi.fn(),
    findRefreshSession: vi.fn(),
    rotateRefreshToken: vi.fn(),
    revokeRefreshSession: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllRefreshTokens: vi.fn(),
    issueOneTimeToken: vi.fn(),
    consumeOneTimeToken: vi.fn(),
  };
  const usersService = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findForAuthentication: vi.fn(),
    findWithCredentialsById: vi.fn(),
    findWithCredentialsByEmail: vi.fn(),
    setPassword: vi.fn(),
    activate: vi.fn(),
    rotateSecurityStamp: vi.fn(),
  };
  const hashingService = { hashPassword: vi.fn(), verifyPassword: vi.fn() };
  const otpService = { issue: vi.fn(), verify: vi.fn() };
  const mailService = { sendMail: vi.fn() };
  const transactions = { run: vi.fn(<T>(work: () => Promise<T>) => work()) };
  const authFactory = { toUserResponse: vi.fn() };
  const config = {
    getOrThrow: vi.fn(
      (key: string) => ({ [Config.OTP_EXPIRY_MINUTES]: 5, [Config.APP_CLIENT_URL]: 'https://app.osloop.test' })[key],
    ),
  };

  const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
  const userWithId = (overrides: Parameters<typeof buildUser>[0] = {}) => buildUser({ id: randomUUID(), ...overrides });

  beforeEach(async () => {
    vi.clearAllMocks();
    hashingService.hashPassword.mockResolvedValue('hashed');
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: TokenService, useValue: tokenService },
        { provide: UsersService, useValue: usersService },
        { provide: HashingService, useValue: hashingService },
        { provide: OtpService, useValue: otpService },
        { provide: MailService, useValue: mailService },
        { provide: TransactionService, useValue: transactions },
        { provide: AuthFactory, useValue: authFactory },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    await service.onModuleInit();
    hashingService.hashPassword.mockClear();
  });

  describe('login', () => {
    const credentials = { email: 'User@Example.com', password: 'password12345' };

    it('issues tokens and returns the mapped user on success', async () => {
      const user = userWithId();
      usersService.findWithCredentialsByEmail.mockResolvedValue(user);
      hashingService.verifyPassword.mockResolvedValue(true);
      tokenService.issueTokens.mockResolvedValue(tokens);
      authFactory.toUserResponse.mockReturnValue({ id: user.id });

      await expect(service.login(credentials)).resolves.toEqual({
        message: 'Login successful',
        data: { passwordChangeRequired: false, tokens, user: { id: user.id } },
      });
      expect(hashingService.verifyPassword).toHaveBeenCalledWith(user.passwordHash, credentials.password);
      expect(tokenService.issueTokens).toHaveBeenCalledWith(user.id, user.securityStamp);
    });

    it('verifies against a dummy hash when the user does not exist', async () => {
      usersService.findWithCredentialsByEmail.mockResolvedValue(null);
      hashingService.verifyPassword.mockResolvedValue(false);

      await expect(service.login(credentials)).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      expect(hashingService.verifyPassword).toHaveBeenCalledWith('hashed', credentials.password);
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      usersService.findWithCredentialsByEmail.mockResolvedValue(userWithId());
      hashingService.verifyPassword.mockResolvedValue(false);

      await expect(service.login(credentials)).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for a user that is not active', async () => {
      usersService.findWithCredentialsByEmail.mockResolvedValue(userWithId({ status: UserStatus.DISABLED }));
      hashingService.verifyPassword.mockResolvedValue(true);

      await expect(service.login(credentials)).rejects.toBeInstanceOf(ForbiddenException);
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });

    it('returns a forced password change token, keyed by user id, instead of tokens', async () => {
      const user = userWithId({ mustChangePassword: true });
      usersService.findWithCredentialsByEmail.mockResolvedValue(user);
      hashingService.verifyPassword.mockResolvedValue(true);
      tokenService.issueOneTimeToken.mockResolvedValue('change-token');

      await expect(service.login(credentials)).resolves.toEqual({
        message: 'Password change required',
        data: { passwordChangeRequired: true, passwordChangeToken: 'change-token' },
      });
      expect(tokenService.issueOneTimeToken).toHaveBeenCalledWith(OneTimeTokenPurpose.FORCED_PASSWORD_CHANGE, user.id);
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const session = { id: randomUUID(), userId: randomUUID(), securityStamp: randomUUID(), tokenHash: 'hash' };

    it('rotates the refresh token for a valid session', async () => {
      tokenService.findRefreshSession.mockResolvedValue(session);
      usersService.findForAuthentication.mockResolvedValue(
        userWithId({ id: session.userId, securityStamp: session.securityStamp }),
      );
      tokenService.rotateRefreshToken.mockResolvedValue(tokens);

      await expect(service.refresh({ refreshToken: 'raw' })).resolves.toEqual({
        message: 'Tokens refreshed successfully',
        data: { tokens },
      });
      expect(tokenService.findRefreshSession).toHaveBeenCalledWith('raw');
      expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith(session);
    });

    it('revokes the session when the security stamp changed since the token was issued', async () => {
      tokenService.findRefreshSession.mockResolvedValue(session);
      usersService.findForAuthentication.mockResolvedValue(
        userWithId({ id: session.userId, securityStamp: randomUUID() }),
      );

      await expect(service.refresh({ refreshToken: 'raw' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokenService.revokeRefreshSession).toHaveBeenCalledWith(session.id);
      expect(tokenService.rotateRefreshToken).not.toHaveBeenCalled();
    });

    it('revokes the session when the user is no longer active', async () => {
      tokenService.findRefreshSession.mockResolvedValue(session);
      usersService.findForAuthentication.mockResolvedValue(
        userWithId({ securityStamp: session.securityStamp, status: UserStatus.DISABLED }),
      );

      await expect(service.refresh({ refreshToken: 'raw' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokenService.revokeRefreshSession).toHaveBeenCalledWith(session.id);
    });

    it('revokes the session when the user no longer exists', async () => {
      tokenService.findRefreshSession.mockResolvedValue(session);
      usersService.findForAuthentication.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'raw' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokenService.revokeRefreshSession).toHaveBeenCalledWith(session.id);
    });

    it('propagates an invalid refresh token error', async () => {
      tokenService.findRefreshSession.mockRejectedValueOnce(new UnauthorizedException());
      await expect(service.refresh({ refreshToken: 'raw' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.findForAuthentication).not.toHaveBeenCalled();
    });
  });

  describe('completeForcedPasswordChange', () => {
    const dto = {
      token: 'change-token',
      newPassword: 'MyNewSecurePassword123',
      confirmPassword: 'MyNewSecurePassword123',
    };

    it('sets the password of the user the token was issued for and revokes their sessions in one transaction', async () => {
      const userId = randomUUID();
      tokenService.consumeOneTimeToken.mockResolvedValue(userId);

      await expect(service.completeForcedPasswordChange(dto)).resolves.toEqual({ message: expect.any(String) });
      expect(tokenService.consumeOneTimeToken).toHaveBeenCalledWith(
        OneTimeTokenPurpose.FORCED_PASSWORD_CHANGE,
        'change-token',
      );
      expect(hashingService.hashPassword).toHaveBeenCalledWith(dto.newPassword);
      expect(usersService.setPassword).toHaveBeenCalledWith(userId, 'hashed');
      expect(tokenService.revokeAllRefreshTokens).toHaveBeenCalledWith(userId);
      expect(transactions.run).toHaveBeenCalledOnce();
    });

    it('throws when the token is invalid or already used', async () => {
      tokenService.consumeOneTimeToken.mockRejectedValueOnce(new UnauthorizedException());
      await expect(service.completeForcedPasswordChange(dto)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the user no longer exists', async () => {
      tokenService.consumeOneTimeToken.mockResolvedValue(randomUUID());
      usersService.setPassword.mockRejectedValueOnce(new NotFoundException());
      await expect(service.completeForcedPasswordChange(dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requestChangePasswordOtp', () => {
    it('issues an OTP and awaits the email', async () => {
      const user = userWithId({ role: UserRole.SUPER_ADMIN });
      otpService.issue.mockResolvedValue('123456');

      await expect(service.requestChangePasswordOtp(user)).resolves.toEqual({
        message: 'OTP sent to your registered email',
      });
      expect(otpService.issue).toHaveBeenCalledWith(`change_password_otp:${user.id}`);
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: user.email, text: expect.stringContaining('123456') }),
      );
    });

    it('propagates a cooldown error without sending an email', async () => {
      otpService.issue.mockRejectedValueOnce(new HttpException('wait', 429));
      await expect(service.requestChangePasswordOtp(userWithId())).rejects.toBeInstanceOf(HttpException);
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('propagates mail queue failures', async () => {
      otpService.issue.mockResolvedValue('123456');
      mailService.sendMail.mockRejectedValueOnce(new Error('queue down'));
      await expect(service.requestChangePasswordOtp(userWithId())).rejects.toThrow('queue down');
    });
  });

  describe('changePassword', () => {
    const dto = {
      currentPassword: 'MyCurrentPassword1',
      newPassword: 'MyNewSecurePassword123',
      confirmPassword: 'MyNewSecurePassword123',
    };

    it('sets the password, revokes old sessions and returns new tokens', async () => {
      const user = userWithId();
      usersService.findWithCredentialsById.mockResolvedValue(user);
      hashingService.verifyPassword.mockResolvedValue(true);
      usersService.setPassword.mockResolvedValue('new-stamp');
      tokenService.issueTokens.mockResolvedValue(tokens);

      await expect(service.changePassword(dto, user.id)).resolves.toEqual({
        message: 'Password changed successfully',
        data: { tokens },
      });
      expect(usersService.setPassword).toHaveBeenCalledWith(user.id, 'hashed');
      expect(tokenService.revokeAllRefreshTokens).toHaveBeenCalledWith(user.id);
      expect(tokenService.issueTokens).toHaveBeenCalledWith(user.id, 'new-stamp');
      expect(transactions.run).toHaveBeenCalledOnce();
      expect(otpService.verify).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the current password is wrong', async () => {
      usersService.findWithCredentialsById.mockResolvedValue(userWithId());
      hashingService.verifyPassword.mockResolvedValue(false);

      await expect(service.changePassword(dto, randomUUID())).rejects.toThrow(
        new ForbiddenException('Current password is incorrect'),
      );
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      usersService.findWithCredentialsById.mockResolvedValue(null);
      await expect(service.changePassword(dto, randomUUID())).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('requires an OTP from a super admin', async () => {
      usersService.findWithCredentialsById.mockResolvedValue(userWithId({ role: UserRole.SUPER_ADMIN }));
      hashingService.verifyPassword.mockResolvedValue(true);

      await expect(service.changePassword(dto, randomUUID())).rejects.toBeInstanceOf(ForbiddenException);
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });

    it('rejects a super admin with a wrong OTP', async () => {
      usersService.findWithCredentialsById.mockResolvedValue(userWithId({ role: UserRole.SUPER_ADMIN }));
      hashingService.verifyPassword.mockResolvedValue(true);
      otpService.verify.mockResolvedValue(false);

      await expect(service.changePassword({ ...dto, otp: '000000' }, randomUUID())).rejects.toThrow(
        new ForbiddenException('Invalid or expired OTP'),
      );
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });

    it('accepts a super admin with a valid OTP', async () => {
      const admin = userWithId({ role: UserRole.SUPER_ADMIN });
      usersService.findWithCredentialsById.mockResolvedValue(admin);
      hashingService.verifyPassword.mockResolvedValue(true);
      otpService.verify.mockResolvedValue(true);
      usersService.setPassword.mockResolvedValue('new-stamp');
      tokenService.issueTokens.mockResolvedValue(tokens);

      await expect(service.changePassword({ ...dto, otp: '123456' }, admin.id)).resolves.toMatchObject({
        data: { tokens },
      });
      expect(otpService.verify).toHaveBeenCalledWith(`change_password_otp:${admin.id}`, '123456');
    });
  });

  describe('sendActivationEmail', () => {
    it('emails an invited user a single-use activation link', async () => {
      const user = userWithId({ status: UserStatus.INVITED });
      usersService.findById.mockResolvedValue(user);
      tokenService.issueOneTimeToken.mockResolvedValue('activation-token');

      await expect(service.sendActivationEmail(user.id)).resolves.toEqual({ message: 'Activation email sent' });
      expect(tokenService.issueOneTimeToken).toHaveBeenCalledWith(OneTimeTokenPurpose.ACCOUNT_ACTIVATION, user.id);
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: user.email,
          text: expect.stringContaining('https://app.osloop.test/activate-account?token=activation-token'),
        }),
      );
    });

    it('throws NotFoundException for an unknown user', async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(service.sendActivationEmail(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException for a user who is not invited', async () => {
      usersService.findById.mockResolvedValue(userWithId({ status: UserStatus.ACTIVE }));
      await expect(service.sendActivationEmail(randomUUID())).rejects.toBeInstanceOf(ForbiddenException);
      expect(tokenService.issueOneTimeToken).not.toHaveBeenCalled();
    });
  });

  describe('activateAccount', () => {
    const dto = {
      token: 'activation-token',
      password: 'MyNewSecurePassword123',
      confirmPassword: 'MyNewSecurePassword123',
    };

    it('consumes the token and activates the user', async () => {
      const userId = randomUUID();
      tokenService.consumeOneTimeToken.mockResolvedValue(userId);

      await expect(service.activateAccount(dto)).resolves.toEqual({ message: expect.any(String) });
      expect(tokenService.consumeOneTimeToken).toHaveBeenCalledWith(
        OneTimeTokenPurpose.ACCOUNT_ACTIVATION,
        'activation-token',
      );
      expect(usersService.activate).toHaveBeenCalledWith(userId, 'hashed');
    });

    it('throws when the token is invalid or already used', async () => {
      tokenService.consumeOneTimeToken.mockRejectedValueOnce(new UnauthorizedException());
      await expect(service.activateAccount(dto)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.activate).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when the user is no longer invited', async () => {
      tokenService.consumeOneTimeToken.mockResolvedValue(randomUUID());
      usersService.activate.mockRejectedValueOnce(new NotFoundException());
      await expect(service.activateAccount(dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('forgotPassword', () => {
    it('emails an active user a reset link', async () => {
      const user = userWithId();
      usersService.findByEmail.mockResolvedValue(user);
      tokenService.issueOneTimeToken.mockResolvedValue('reset-token');

      await expect(service.forgotPassword({ email: user.email })).resolves.toEqual({ message: expect.any(String) });
      expect(tokenService.issueOneTimeToken).toHaveBeenCalledWith(OneTimeTokenPurpose.PASSWORD_RESET, user.id);
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('/reset-password?token=reset-token') }),
      );
    });

    it('responds identically without sending anything when the account does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const known = userWithId();

      const response = await service.forgotPassword({ email: 'nobody@example.com' });
      usersService.findByEmail.mockResolvedValue(known);
      await expect(service.forgotPassword({ email: known.email })).resolves.toEqual(response);
      expect(mailService.sendMail).toHaveBeenCalledOnce();
    });

    it('does not send a reset link to an inactive user', async () => {
      usersService.findByEmail.mockResolvedValue(userWithId({ status: UserStatus.DISABLED }));
      await service.forgotPassword({ email: 'user@example.com' });
      expect(tokenService.issueOneTimeToken).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const dto = {
      token: 'reset-token',
      newPassword: 'MyNewSecurePassword123',
      confirmPassword: 'MyNewSecurePassword123',
    };

    it('sets the new password and revokes every session in one transaction', async () => {
      const userId = randomUUID();
      tokenService.consumeOneTimeToken.mockResolvedValue(userId);

      await expect(service.resetPassword(dto)).resolves.toEqual({ message: expect.any(String) });
      expect(tokenService.consumeOneTimeToken).toHaveBeenCalledWith(OneTimeTokenPurpose.PASSWORD_RESET, 'reset-token');
      expect(usersService.setPassword).toHaveBeenCalledWith(userId, 'hashed');
      expect(tokenService.revokeAllRefreshTokens).toHaveBeenCalledWith(userId);
      expect(transactions.run).toHaveBeenCalledOnce();
    });

    it('throws when the token is invalid or already used', async () => {
      tokenService.consumeOneTimeToken.mockRejectedValueOnce(new UnauthorizedException());
      await expect(service.resetPassword(dto)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.setPassword).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the current session', async () => {
      const session = { sid: randomUUID(), exp: 1_900_000_000 };
      await expect(service.logout(session)).resolves.toBeUndefined();
      expect(tokenService.revokeSession).toHaveBeenCalledWith(session.sid, session.exp);
    });
  });

  describe('revokeUserSessions', () => {
    it('rotates the security stamp and deletes refresh tokens in one transaction', async () => {
      const userId = randomUUID();
      await expect(service.revokeUserSessions(userId)).resolves.toEqual({
        message: 'User logged out from all devices successfully',
      });
      expect(usersService.rotateSecurityStamp).toHaveBeenCalledWith(userId);
      expect(tokenService.revokeAllRefreshTokens).toHaveBeenCalledWith(userId);
      expect(transactions.run).toHaveBeenCalledOnce();
    });

    it('throws NotFoundException for an unknown user', async () => {
      usersService.rotateSecurityStamp.mockRejectedValueOnce(new NotFoundException('User not found'));
      await expect(service.revokeUserSessions(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
      expect(tokenService.revokeAllRefreshTokens).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns the mapped user', () => {
      const user = userWithId();
      authFactory.toUserResponse.mockReturnValue({ id: user.id });
      expect(service.getCurrentUser(user)).toEqual({
        message: 'Current user information retrieved successfully',
        data: { id: user.id },
      });
      expect(authFactory.toUserResponse).toHaveBeenCalledWith(user);
    });
  });
});
