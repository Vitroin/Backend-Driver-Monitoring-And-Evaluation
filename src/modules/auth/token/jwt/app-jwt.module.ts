import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { jwtConfig } from './jwt-module.config';

@Module({
  imports: [JwtModule.registerAsync(jwtConfig())],
  exports: [JwtModule],
})
export class AppJwtModule {}
