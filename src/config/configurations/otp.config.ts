import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  expiryMinutes: process.env.OTP_EXPIRY_MINUTES,
  secret: process.env.OTP_SECRET,
}));
