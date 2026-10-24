import { FeaturesModule } from '@modules/features.module';
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { CoreModule } from './core';
import { InfrastructureModule } from './infrastructure';

@Module({
  imports: [InfrastructureModule, CoreModule, FeaturesModule, AppConfigModule],
})
export class AppModule {}
