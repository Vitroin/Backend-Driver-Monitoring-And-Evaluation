import { Module } from '@nestjs/common';
import { DatabaseModule } from './database';
import { AppCacheModule } from './cache';
import { QueueModule } from './queue';
@Module({
  imports: [DatabaseModule, AppCacheModule, QueueModule],
})
export class InfrastructureModule {}
