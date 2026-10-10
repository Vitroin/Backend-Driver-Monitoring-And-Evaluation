import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config';
import { CoreModule } from './core';
import { InfrastructureModule } from './infrastructure';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { FeaturesModule } from '@modules/features.module';

@Module({
  imports: [InfrastructureModule, CoreModule, FeaturesModule, AppConfigModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
