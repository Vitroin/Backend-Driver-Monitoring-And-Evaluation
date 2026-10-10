import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginSchema } from './dtos';
import type { LoginDto, CreateUserDto } from './dtos';
import {  CreateUserSchema } from './dtos/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body({ schema: LoginSchema }) loginDto: LoginDto) {
    await this.authService.login(loginDto);
  }
  
  @Post('users')
  createUser(@Body({ schema: CreateUserSchema }) dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }
}
