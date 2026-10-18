import { Module } from '@nestjs/common';
import { FastApiService } from './fast-api.service';
import { FastApiController } from './fast-api.controller';

@Module({

  controllers: [FastApiController],
  providers: [FastApiService],
  exports: [FastApiService],
})
export class FastApiModule {}
