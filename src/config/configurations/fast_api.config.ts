import { registerAs } from '@nestjs/config';

export default registerAs('fastapi', () => ({
    url: process.env.FASTAPI_URL,
    timeoutMs: process.env.FASTAPI_TIMEOUT_MS,
    serviceToken: process.env.SERVICE_TOKEN,
}));
