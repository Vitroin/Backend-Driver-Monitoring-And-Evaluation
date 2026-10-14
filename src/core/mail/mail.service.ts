import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { SendMailOptions } from 'nodemailer';
import { MAIL_JOB_OPTIONS, MAIL_QUEUE, SEND_MAIL_JOB } from './mail.constant';

@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue<SendMailOptions>) {}

  async sendMail(mailOptions: SendMailOptions) {
    await this.mailQueue.add(SEND_MAIL_JOB, mailOptions, MAIL_JOB_OPTIONS);
  }
}