import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ConfigNames } from '@config';
import { MailProcessor } from './mail.processor';
import { MailService } from './mail.service';
import { MAIL_QUEUE, MAIL_TRANSPORT } from './mail.constant';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: MAIL_QUEUE })],
  providers: [
    MailService,
    MailProcessor,
    {
      // One transporter for the whole app; it keeps its SMTP connection between emails
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        nodemailer.createTransport({
          service: 'gmail',
          pool: true,
          auth: {
            user: config.getOrThrow<string>(ConfigNames.MAILER_USERNAME),
            pass: config.getOrThrow<string>(ConfigNames.MAILER_PASSWORD),
          },
        }),
    },
  ],
  exports: [MailService],
})
export class MailModule {}
