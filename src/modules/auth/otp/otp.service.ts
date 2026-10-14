import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { OtpPurpose } from './otp-purpose.enum';
import { CacheService } from '@infrastructure/cache/cache.service';
import { ConfigNames } from '@config';

interface OtpRecord {
  /** HMAC-SHA256 of the OTP, hex encoded. */
  hash: string;
  /** Wrong guesses so far. */
  attempts: number;
  /** Epoch milliseconds; kept so a wrong guess can rewrite the record without extending its lifetime. */
  expiresAt: number;
}

export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

@Injectable()
export class OtpService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly config: ConfigService,
  ) {}

  generate(length: number = OTP_LENGTH): string {
    return crypto
      .randomInt(0, 10 ** length)
      .toString()
      .padStart(length, '0');
  }

  /**
   * Generates an OTP and stores its HMAC under `key`, replacing any previous OTP for that key.
   * @param {OtpPurpose} purpose  The purpose of the OTP.
   * @param {string} userId The ID of the user for whom the OTP is being generated.
   * @throws HttpException 429 when an OTP was issued for the same key less than a minute ago.
   * @returns The plain OTP, to be sent to the user.
   */
  async issue(purpose: OtpPurpose, userId: string): Promise<string> {
    const key = this.cacheKey(purpose, userId);
    const otp = this.generate();
    const ttl = this.config.getOrThrow<number>(ConfigNames.OTP_EXPIRY_MINUTES) * 60;
    const record: OtpRecord = { hash: this.hmac(otp), attempts: 0, expiresAt: Date.now() + ttl * 1000 };
    await this.cacheService.set({ key, value: record, ttl });
    return otp;
  }

  /**
   * Checks an OTP. A correct OTP is consumed (it works once). After `OTP_MAX_ATTEMPTS` wrong guesses the OTP
   * is deleted, so a 6-digit code can't be brute-forced within its lifetime.
   * @param {OtpPurpose} purpose The purpose of the OTP.
   * @param {string} userId The ID of the user for whom the OTP is being verified.
   * @param {string} otp The OTP to verify.
   * @returns {Promise<boolean>} True if the OTP is valid, false otherwise.
   */
  async verify(purpose: OtpPurpose, userId: string, otp: string): Promise<boolean> {
    const key = this.cacheKey(purpose, userId);
    const record = await this.cacheService.get<OtpRecord>(key);
    if (!record) return false;

    if (this.matches(record.hash, otp)) return (await this.cacheService.take<OtpRecord>(key)) !== undefined;

    const attempts = record.attempts + 1;
    const remainingSeconds = Math.ceil((record.expiresAt - Date.now()) / 1000);
    if (attempts >= OTP_MAX_ATTEMPTS || remainingSeconds <= 0) await this.cacheService.delete(key);
    else await this.cacheService.set({ key, value: { ...record, attempts }, ttl: remainingSeconds });
    return false;
  }

  private matches(expectedHash: string, otp: string): boolean {
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(this.hmac(otp), 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  private hmac(otp: string): string {
    return crypto.createHmac('sha256', this.config.getOrThrow<string>(ConfigNames.OTP_SECRET)).update(otp).digest('hex');
  }

  private cacheKey(purpose: OtpPurpose, userId: string): string {
    return `otp:${purpose}:${userId}`;
  }
}
