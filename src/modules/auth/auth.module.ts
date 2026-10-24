import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MailModule } from '@Core/mail';
import { TransactionsModule } from '@shared/modules/transactions/transactions.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthFactory } from './auth.factory';
import { Authenticator } from './authenticator.service';
import { TokenModule } from './token';
import { AuthenticationGuard, RolesGuard } from './guards';
import { HashingModule } from './hashing';
import { OtpModule } from './otp';
import { AuthMailService } from './auth-mail.service';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [TokenModule, UsersModule, OtpModule, MailModule, HashingModule, TransactionsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthFactory,
    AuthMailService,
    Authenticator,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, Authenticator],
})
export class AuthModule {}
