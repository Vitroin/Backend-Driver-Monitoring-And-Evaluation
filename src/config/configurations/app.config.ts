import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  clientUrl: process.env.APP_CLIENT_URL,
  clientPort: Number(process.env.APP_CLIENT_PORT),
}));