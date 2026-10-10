import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { MailProcessor } from './mail.processor';
import { MailService } from './mail.service';
import { MAIL_QUEUE } from './mail.constant';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: MAIL_QUEUE })],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}