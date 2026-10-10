import { Module } from '@nestjs/common';
import { DatabaseModule } from './database';
import { AppCacheModule } from './cache';
@Module({
  imports: [DatabaseModule, AppCacheModule],
})
export class InfrastructureModule {}
