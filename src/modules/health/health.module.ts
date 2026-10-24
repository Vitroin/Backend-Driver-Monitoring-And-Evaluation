import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { FastApiModule } from '@modules/fast-api/fast-api.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, FastApiModule],
  controllers: [HealthController],
})
export class HealthModule {}
