import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailModule } from './mail/mail.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    MailModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 60 }]),
  ],
  providers: [
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [],
})
export class CoreModule {}
