import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { buildUser } from '../../../test/factories/user.factory';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    login: vi.fn(),
    refresh: vi.fn(),
    completeForcedPasswordChange: vi.fn(),
    activateAccount: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    requestChangePasswordOtp: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    sendActivationEmail: vi.fn(),
    revokeUserSessions: vi.fn(),
    getCurrentUser: vi.fn(),
  };
  const result = { message: 'ok' };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  describe('login', () => {
    const dto = { email: 'user@example.com', password: 'password12345' };

    it('delegates to the service and returns its result', async () => {
      authService.login.mockResolvedValue(result);
      await expect(controller.login(dto)).resolves.toBe(result);
      expect(authService.login).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      authService.login.mockRejectedValueOnce(new UnauthorizedException());
      await expect(controller.login(dto)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('delegates to the service and returns its result', async () => {
      authService.refresh.mockResolvedValue(result);
      await expect(controller.refresh({ refreshToken: 'raw' })).resolves.toBe(result);
      expect(authService.refresh).toHaveBeenCalledWith({ refreshToken: 'raw' });
    });

    it('propagates service errors', async () => {
      authService.refresh.mockRejectedValueOnce(new UnauthorizedException());
      await expect(controller.refresh({ refreshToken: 'raw' })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('completeForcedPasswordChange', () => {
    const dto = { token: 't', newPassword: 'MyNewSecurePassword123', confirmPassword: 'MyNewSecurePassword123' };

    it('delegates to the service and returns its result', async () => {
      authService.completeForcedPasswordChange.mockResolvedValue(result);
      await expect(controller.completeForcedPasswordChange(dto)).resolves.toBe(result);
      expect(authService.completeForcedPasswordChange).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      authService.completeForcedPasswordChange.mockRejectedValueOnce(new UnauthorizedException());
      await expect(controller.completeForcedPasswordChange(dto)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('activateAccount', () => {
    const dto = { token: 't', password: 'MyNewSecurePassword123', confirmPassword: 'MyNewSecurePassword123' };

    it('delegates to the service and returns its result', async () => {
      authService.activateAccount.mockResolvedValue(result);
      await expect(controller.activateAccount(dto)).resolves.toBe(result);
      expect(authService.activateAccount).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      authService.activateAccount.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.activateAccount(dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('forgotPassword', () => {
    it('delegates to the service and returns its result', async () => {
      authService.forgotPassword.mockResolvedValue(result);
      await expect(controller.forgotPassword({ email: 'user@example.com' })).resolves.toBe(result);
      expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' });
    });
  });

  describe('resetPassword', () => {
    const dto = { token: 't', newPassword: 'MyNewSecurePassword123', confirmPassword: 'MyNewSecurePassword123' };

    it('delegates to the service and returns its result', async () => {
      authService.resetPassword.mockResolvedValue(result);
      await expect(controller.resetPassword(dto)).resolves.toBe(result);
      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      authService.resetPassword.mockRejectedValueOnce(new UnauthorizedException());
      await expect(controller.resetPassword(dto)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('requestChangePasswordOtp', () => {
    it('delegates to the service with the current user', async () => {
      const user = buildUser({ id: randomUUID() });
      authService.requestChangePasswordOtp.mockResolvedValue(result);
      await expect(controller.requestChangePasswordOtp(user)).resolves.toBe(result);
      expect(authService.requestChangePasswordOtp).toHaveBeenCalledWith(user);
    });
  });

  describe('changePassword', () => {
    const dto = { currentPassword: 'MyCurrentPassword1', newPassword: 'MyNewSecurePassword123', confirmPassword: 'MyNewSecurePassword123' };

    it('delegates to the service with the current user id', async () => {
      const userId = randomUUID();
      authService.changePassword.mockResolvedValue(result);
      await expect(controller.changePassword(dto, userId)).resolves.toBe(result);
      expect(authService.changePassword).toHaveBeenCalledWith(dto, userId);
    });

    it('propagates service errors', async () => {
      authService.changePassword.mockRejectedValueOnce(new ForbiddenException());
      await expect(controller.changePassword(dto, randomUUID())).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('delegates to the service with the current session', async () => {
      const session = { sid: randomUUID(), exp: 1_900_000_000 };
      authService.logout.mockResolvedValue(undefined);
      await expect(controller.logout(session)).resolves.toBeUndefined();
      expect(authService.logout).toHaveBeenCalledWith(session);
    });
  });

  describe('sendActivationEmail', () => {
    it('delegates to the service with the id from the path', async () => {
      const id = randomUUID();
      authService.sendActivationEmail.mockResolvedValue(result);
      await expect(controller.sendActivationEmail({ id })).resolves.toBe(result);
      expect(authService.sendActivationEmail).toHaveBeenCalledWith(id);
    });

    it('propagates service errors', async () => {
      authService.sendActivationEmail.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.sendActivationEmail({ id: randomUUID() })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('revokeUserSessions', () => {
    it('delegates to the service with the id from the path', async () => {
      const id = randomUUID();
      authService.revokeUserSessions.mockResolvedValue(result);
      await expect(controller.revokeUserSessions({ id })).resolves.toBe(result);
      expect(authService.revokeUserSessions).toHaveBeenCalledWith(id);
    });

    it('propagates service errors', async () => {
      authService.revokeUserSessions.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.revokeUserSessions({ id: randomUUID() })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getCurrentUser', () => {
    it('delegates to the service with the current user', () => {
      const user = buildUser({ id: randomUUID() });
      authService.getCurrentUser.mockReturnValue(result);
      expect(controller.getCurrentUser(user)).toBe(result);
      expect(authService.getCurrentUser).toHaveBeenCalledWith(user);
    });
  });
});
