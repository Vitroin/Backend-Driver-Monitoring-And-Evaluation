import { generateOtpCode } from '@common';
import { OTP_TTL } from '@common/constant/otp_ttl.constant';
import { MailService } from '@Core/mail';
import { UsersService } from '@modules/users/users.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';
import { mongo } from 'mongoose';
import { ForgetPasswordDto } from './dtos';
import { CreateUserDto } from './dtos/create-user.dto';
import { LoginDto } from './dtos/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly mailService: MailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException('Invalid username or password');

    const isValidUser = await bcrypt.compare(dto.password, user.password);
    if (!isValidUser) throw new UnauthorizedException('Invalid username or password');

    return { id: user._id, username: user.username, email: user.email, role: user.role };
  }

  async createUser(dto: CreateUserDto) {
    const password = this.generatePassword();
    const hashedPass = await bcrypt.hash(password, 10);

    try {
      const newUser = await this.usersService.createUser(dto, hashedPass);

      await this.mailService.sendWelcomeEmail(newUser.email, newUser.username, password);

      return { id: newUser._id, username: newUser.username, email: newUser.email, role: newUser.role };
    } catch (error) {
      if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) throw error;

      const field = error.keyPattern?.username ? 'Username' : 'Email';
      throw new ConflictException(`${field} already exists`);
    }
  }

  private generatePassword(): string {
    const password = randomBytes(9).toString('base64url');
    return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)
      ? password
      : this.generatePassword();
  }

  async forgetPassword(dto: ForgetPasswordDto) {
    const response = { message: 'If an account exists, a reset code has been sent to its email.' };

    const user = await this.usersService.findByUsername(dto.username);
    if (!user) return response;

    const otp = generateOtpCode();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await this.cache.set(`reset-password:${user._id}`, { hashedOtp, attempts: 0 }, OTP_TTL);
    await this.mailService.sendResetPasswordCode(user.email, otp);

    return response;
  }
}
