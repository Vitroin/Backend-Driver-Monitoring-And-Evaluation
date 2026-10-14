import { ConfigNames } from '@config';
import { MailService } from '@Core/mail';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const IGNORE_NOTICE = 'If you did not request this, please ignore this email and inform your system administrator immediately.';

@Injectable()
export class AuthMailService {
  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async sendInvitationEmail(to: string, activationToken: string) {
    const activationLink = this.clientLink('/activate-account', activationToken);
    await this.mailService.sendMail({
      to,
      subject: 'Welcome to Sahi! Activate Your Account',
      text: `You have been invited to join Sahi. Open the link below to activate your account and set your password.\n\n${activationLink}\n\n${IGNORE_NOTICE}`,
      html: `
        <p>You have been invited to join Sahi. Click the button below to activate your account and set your password.</p>
        <p><a href="${activationLink}" rel="noopener noreferrer">Activate Account</a></p>
        <p>${IGNORE_NOTICE}</p>`,
    });
  }

  async sendResetPasswordEmail(to: string, otp: string) {
    await this.sendOtpEmail(to, otp, 'Reset Your Password', 'You have requested to reset your password.');
  }

  async sendChangePasswordEmail(to: string, otp: string) {
    await this.sendOtpEmail(to, otp, 'Change Your Password', 'You have requested to change your password.');
  }

  /** Both OTP emails have the same layout; only the subject and the first sentence differ. */
  private async sendOtpEmail(to: string, otp: string, subject: string, intro: string) {
    await this.mailService.sendMail({
      to,
      subject,
      text: `${intro} Use the one-time password (OTP) below to continue.\n\n${otp}\n\n${IGNORE_NOTICE}`,
      html: `
        <p>${intro} Use the one-time password (OTP) below to continue.</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>${IGNORE_NOTICE}</p>`,
    });
  }

  /** Builds a link to the frontend, e.g. https://app.sahi.com/activate-account?token=... */
  private clientLink(path: string, token: string): string {
    const url = new URL(path, this.configService.getOrThrow<string>(ConfigNames.APP_CLIENT_URL));
    url.searchParams.set('token', token);
    return url.toString();
  }
}