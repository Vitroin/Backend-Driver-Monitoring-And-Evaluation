import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const swaggerSetup = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle('Driver Monitoring And Evaluation System')
    .setDescription('Driver Monitoring And Evaluation System documentation')
    .setVersion('0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      displayRequestDuration: true,
      persistAuthorization: true,
    },
  });
};