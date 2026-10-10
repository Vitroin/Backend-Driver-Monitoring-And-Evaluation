import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ConfigNames } from '@config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow(ConfigNames.REDIS_HOST),
          port: Number(configService.getOrThrow(ConfigNames.REDIS_PORT)),
        },
      }),
    }),
  ],
})
export class QueueModule {}
