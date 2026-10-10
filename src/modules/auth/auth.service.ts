import { UsersService } from '@modules/users/users.service';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { LoginDto } from './dtos/login.dto';
import { randomBytes } from 'crypto';
import { CreateUserDto } from './dtos/create-user.dto';
import { mongo } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}


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
      return { id: newUser._id, username: newUser.username, email: newUser.email, password };
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

  
}
