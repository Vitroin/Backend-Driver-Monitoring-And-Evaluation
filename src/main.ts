import { swaggerSetup } from '@Core';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { ConfigNames } from './config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  swaggerSetup(app);

  await app.listen(app.get(ConfigService).getOrThrow<number>(ConfigNames.APP_PORT), '0.0.0.0');
}

bootstrap();
