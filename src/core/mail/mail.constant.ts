import type { JobsOptions } from 'bullmq';

export const MAIL_QUEUE = 'mail';
export const SEND_MAIL_JOB = 'send-mail';

export const MAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 3,                                   // retry up to 3 times if sending fails
  backoff: { type: 'exponential', delay: 5000 }, // wait 5s, then 10s, then 20s
  removeOnComplete: true,                        // delete the job (and the password/OTP in it) once sent
  removeOnFail: { age: 24 * 60 * 60 },           // keep failed jobs for 1 day so you can debug them
};