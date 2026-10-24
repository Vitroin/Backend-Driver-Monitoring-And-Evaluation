import { registerAs } from '@nestjs/config';
export default registerAs('app', () => ({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    trustProxy: process.env.TRUST_PROXY,
    logLevel: process.env.LOG_LEVEL,
    clientUrl: process.env.APP_CLIENT_URL,
}));
