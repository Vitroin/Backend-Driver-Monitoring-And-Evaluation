import { z } from 'zod';

export const environmentVariablesValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  // Set to true when the API runs behind a reverse proxy (nginx, a load balancer), so the client IP used by
  // the rate limiter comes from X-Forwarded-For instead of being the proxy's
  TRUST_PROXY: z.stringbool().default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DB_URL: z.string().nonempty({ message: 'DB_URL is required' }),

  // Not used yet (incident clips); optional until the upload code exists
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),

  MAILER_USERNAME: z.string().nonempty({ message: 'MAILER_USERNAME is required' }),
  MAILER_PASSWORD: z.string().nonempty({ message: 'MAILER_PASSWORD is required' }),

  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters long' }),
  JWT_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().positive().default(15),
  JWT_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().positive().default(7),

  REDIS_HOST: z.string().nonempty({ message: 'REDIS_HOST is required' }),
  REDIS_PORT: z.coerce.number().int().default(6379),

  OTP_EXPIRY_MINUTES: z.coerce.number().positive().default(5),
  OTP_SECRET: z.string().min(32, { message: 'OTP_SECRET must be at least 32 characters long' }),

  // The web app: links in emails point here
  APP_CLIENT_URL: z.url({ message: 'APP_CLIENT_URL must be a URL' }),

  FASTAPI_URL: z.url({ message: 'FASTAPI_URL must be a URL' }),
  FASTAPI_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  SERVICE_TOKEN: z.string().nonempty({ message: 'SERVICE_TOKEN is required' }),
});

export type Environment = z.infer<typeof environmentVariablesValidationSchema>;

