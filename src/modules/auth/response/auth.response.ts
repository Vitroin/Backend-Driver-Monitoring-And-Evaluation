import { z } from 'zod';
import { UserRole, UserStatus } from '@common/enums';
import { objectIdSchema } from '@common/types';

export const userResponseSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  username: z.string().meta({ example: 'jane.doe' }),
  email: z.email().meta({ example: 'jane@example.com' }),
  role: z.enum(UserRole),
  status: z.enum(UserStatus),
  mustChangePassword: z.boolean().meta({ description: 'True if the user must set a new password before continuing' }),
});
export type UserResponseDto = z.infer<typeof userResponseSchema>;

export const tokensResponseSchema = z.object({
  accessToken: z.string().meta({
    description: 'Short-lived JWT. Send it as "Authorization: Bearer <token>"',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...',
  }),
  refreshToken: z.string().meta({
    description: 'Single-use token for POST /auth/refresh. Every refresh returns a new one',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...',
  }),
});
export type TokensResponseDto = z.infer<typeof tokensResponseSchema>;

export const loginDataSchema = z.discriminatedUnion('passwordChangeRequired', [
  z.object({
    passwordChangeRequired: z.literal(false),
    tokens: tokensResponseSchema,
    user: userResponseSchema,
  }),
  z.object({
    passwordChangeRequired: z.literal(true),
    passwordChangeToken: z
      .string()
      .meta({ description: 'Single-use token for POST /auth/forced-change-password. Expires in 15 minutes' }),
  }),
]);
export type LoginDataDto = z.infer<typeof loginDataSchema>;

export const changePasswordDataSchema = z.object({ tokens: tokensResponseSchema });

export interface MessageResponseDto {
  message: string;
}

export interface DataResponseDto<T> extends MessageResponseDto {
  data: T;
}
