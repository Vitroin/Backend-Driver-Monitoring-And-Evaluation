import { z } from 'zod';

export const environmentVariablesValidationSchema = z.object({
  PORT: z.coerce.number().default(3000),

  DB_URL: z.string().nonempty({ message: 'DB_URL is required' }),

  CLOUDINARY_API_KEY: z.string().nonempty({ message: 'CLOUDINARY_API_KEY is required' }),
  CLOUDINARY_API_SECRET: z.string().nonempty({ message: 'CLOUDINARY_API_SECRET is required' }),
  CLOUDINARY_CLOUD_NAME: z.string().nonempty({ message: 'CLOUDINARY_CLOUD_NAME is required' }),

  MAILER_USERNAME: z.string().nonempty({ message: 'MAILER_USERNAME is required' }),
  MAILER_PASSWORD: z.string().nonempty({ message: 'MAILER_PASSWORD is required' }),

  JWT_SECRET: z.string().nonempty({ message: 'JWT_SECRET is required' }),

  REDIS_HOST: z.string().nonempty({ message: 'REDIS_HOST is required' }),
  REDIS_PORT: z.coerce.number().default(6379),

  OTP_EXPIRY_MINUTES: z.coerce.number().default(5),
  OTP_SECRET: z.string().nonempty({ message: 'OTP_SECRET is required' }),

  JWT_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  JWT_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  
  APP_CLIENT_URL: z.url({ message: 'APP_CLIENT_URL is required' }),

  FASTAPI_URL: z.url({ message: 'FASTAPI_URL is required' }),
  SERVICE_TOKEN: z.string().nonempty({ message: 'SERVICE_TOKEN is required' }),
});
