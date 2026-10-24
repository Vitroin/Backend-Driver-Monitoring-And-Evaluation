import { Module } from '@nestjs/common';
import { FastApiService } from './fast-api.service';
import { CoachingController } from './fast-api.controller';

@Module({
  controllers: [CoachingController],
  providers: [FastApiService],
  exports: [FastApiService],
})
export class FastApiModule {}
