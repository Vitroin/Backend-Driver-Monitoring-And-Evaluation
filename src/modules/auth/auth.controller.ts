import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginSchema, CreateUserSchema } from './dtos';
import type { LoginDto, CreateUserDto } from './dtos';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body({ schema: LoginSchema }) loginDto: LoginDto) {
    return  this.authService.login(loginDto);
  }
  
  @Post('users')
  createUser(@Body({ schema: CreateUserSchema }) dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }
}
