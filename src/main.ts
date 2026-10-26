import { createFastifyAdapter, swaggerSetup } from '@Core';
import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { environmentVariablesValidationSchema } from '@config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // The Fastify adapter is created before Nest loads .env, so read it here first
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: the variables come from the environment (Docker, CI)
    // eslint-disable-next-line no-console
    console.warn('No .env file found, using environment variables');
  }
  const env = environmentVariablesValidationSchema.parse(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter(env));
  if (env.NODE_ENV !== 'production') swaggerSetup(app);

  await app.listen(env.PORT, '0.0.0.0');
}

bootstrap();
