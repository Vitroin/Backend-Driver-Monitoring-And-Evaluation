import { Module } from "@nestjs/common";
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';


@Module({
  imports:[
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.getOrThrow('redis');
        return {
          stores: [
              createKeyv(`redis://${redis.host}:${redis.port}`), 
          ]
        }
      }
    })
  ]
})

export class AppCacheModule {}