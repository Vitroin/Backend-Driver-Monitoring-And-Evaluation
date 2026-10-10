import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
  ],
  exports: [],
})
export class CoreModule {}
