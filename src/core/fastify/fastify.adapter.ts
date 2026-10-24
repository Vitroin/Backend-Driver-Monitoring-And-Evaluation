import { FastifyAdapter } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import type { Environment } from '@config';

export const createFastifyAdapter = (env: Pick<Environment, 'TRUST_PROXY' | 'LOG_LEVEL'>) =>
  new FastifyAdapter({
    // Behind a reverse proxy, the client IP (used by the rate limiter) comes from X-Forwarded-For
    trustProxy: env.TRUST_PROXY,
    // One JSON log line per request with its id, method, url, status and response time
    logger: { level: env.LOG_LEVEL },
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });
