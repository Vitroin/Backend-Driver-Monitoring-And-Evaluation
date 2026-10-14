import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { environmentVariablesValidationSchema } from './validations';
import { databaseConfig, cloudinaryConfig, mailerConfig, jwtConfig, redisConfig, appConfig, otpConfig } from './configurations';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [databaseConfig, cloudinaryConfig, mailerConfig, jwtConfig, redisConfig, appConfig, otpConfig],
      validationSchema: environmentVariablesValidationSchema,
    }),
  ],
})
export class AppConfigModule {}
