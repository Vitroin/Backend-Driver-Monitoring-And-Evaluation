import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  accessTokenTtlMinutes: process.env.JWT_ACCESS_TOKEN_TTL_MINUTES,
  refreshTokenTtlDays: process.env.JWT_REFRESH_TOKEN_TTL_DAYS,
}));
