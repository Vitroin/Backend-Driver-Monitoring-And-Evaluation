import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { SendMailOptions } from 'nodemailer';
import { MAIL_JOB_OPTIONS, MAIL_QUEUE, SEND_MAIL_JOB } from './mail.constant';

@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue<SendMailOptions>) {}

  async sendResetPasswordCode(email: string, otp: string) {
    await this.mailQueue.add(
      SEND_MAIL_JOB,
      {
        to: email,
        subject: 'Your password reset code',
        text: `Your reset code is ${otp}. It expires in 10 minutes.`,
      },
      MAIL_JOB_OPTIONS,
    );
  }

  async sendWelcomeEmail(email: string, username: string, password: string) {
    await this.mailQueue.add(
      SEND_MAIL_JOB,
      {
        to: email,
        subject: 'Your account has been created',
        text: `Hello ${username}, your account has been created.\n\nUsername: ${username}\nTemporary password: ${password}\n\nPlease change your password after your first login.`,
      },
      MAIL_JOB_OPTIONS,
    );
  }
}