import { ConfigNames } from '@config';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService], // Tells NestJS to inject the ConfigService into the factory function
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>(ConfigNames.DB_URL),
        autoIndex: true, // Automatically build indexes defined in your schemas on startup. Set to false in production for performance reasons.
      }),
    }),
  ],
})
export class DatabaseModule {}
