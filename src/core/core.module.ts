import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [EventEmitterModule.forRoot(), MailModule],
  providers: [
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
  ],
  exports: [],
})
export class CoreModule {}
