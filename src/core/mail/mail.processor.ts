import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { MAIL_QUEUE, MAIL_TRANSPORT } from './mail.constant';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: Transporter) {
    super();
  }

  async process(job: Job<SendMailOptions>) {
    await this.transport.sendMail(job.data);
    this.logger.log(`Email sent with job ${job.id}`);
  }
}
