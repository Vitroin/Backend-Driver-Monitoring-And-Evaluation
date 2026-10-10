import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginSchema } from './dtos';
import type { LoginDto } from './dtos';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body({ schema: LoginSchema }) loginDto: LoginDto) {
    await this.authService.login(loginDto);
  }
}
