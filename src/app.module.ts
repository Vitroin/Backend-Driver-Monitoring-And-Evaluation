import { FeaturesModule } from '@modules/features.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config';
import { CoreModule } from './core';
import { InfrastructureModule } from './infrastructure';

@Module({
  imports: [InfrastructureModule, CoreModule, FeaturesModule, AppConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
