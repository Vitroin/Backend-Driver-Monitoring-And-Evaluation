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
});
