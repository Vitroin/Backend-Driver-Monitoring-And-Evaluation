import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { MAIL_QUEUE } from "./mail.constant";
import { Job } from "bullmq";
import { SendMailOptions } from "nodemailer";
import { sendMail } from "@common";

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost{
  private readonly logger = new Logger(MailProcessor.name);

  async process(job: Job<SendMailOptions>){
    await sendMail(job.data);
    this.logger.log(`Email sent to ${job.data.to} with job: ${job.id}`);
  }
}