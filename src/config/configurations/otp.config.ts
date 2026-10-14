import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),
  secret: process.env.OTP_SECRET,
}));