import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const swaggerSetup = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle('Driver Monitoring And Evaluation System')
    .setDescription(
      'Responses are `{ message, data }`; lists add `meta: { page, limit, total }`. ' +
        'Errors are `{ statusCode, message, error }`. Log in with POST /auth/login and send the access token as a Bearer token.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      displayRequestDuration: true,
      persistAuthorization: true,
    },
  });
};
