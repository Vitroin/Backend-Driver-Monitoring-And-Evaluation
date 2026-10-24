import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { ConfigNames } from '@config';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.getOrThrow<string>(ConfigNames.REDIS_HOST);
        const port = configService.getOrThrow<number>(ConfigNames.REDIS_PORT);
        return { stores: [createKeyv(`redis://${host}:${port}`)] };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule {}
