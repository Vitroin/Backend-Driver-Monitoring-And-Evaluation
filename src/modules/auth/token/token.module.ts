import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { TokenRepository } from './refresh/token.repository';
import { RefreshToken, RefreshTokenSchema } from './refresh/token.model';
import { RefreshTokenCleanupTask, RefreshTokenService } from './refresh';
import { AccessTokenService } from './access';
import { OneTimeTokenService } from './one-time';
import { AppJwtModule } from './jwt';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [AppJwtModule, MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }])],
  providers: [
    TokenService,
    AccessTokenService,
    RefreshTokenService,
    OneTimeTokenService,
    TokenRepository,
    RefreshTokenCleanupTask,
  ],
  exports: [TokenService],
})
export class TokenModule {}
