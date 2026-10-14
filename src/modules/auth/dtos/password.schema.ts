import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * A password being set. Passwords are never trimmed: whitespace is part of the secret,
 * and trimming in some places but not others makes the stored hash unmatchable.
 */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` })
  .max(PASSWORD_MAX_LENGTH, { message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters long` })
  .meta({ description: 'New password', example: 'MyNewSecurePassword123' });

/** A password checked against an existing hash. Only bounded, so it neither leaks nor enforces the current policy. */
export const existingPasswordSchema = z
  .string()
  .min(1, { message: 'Password is required' })
  .max(PASSWORD_MAX_LENGTH, { message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters long` });

/** A single-use token from an emailed link or a login response. */
export const oneTimeTokenSchema = z.string().min(1, { message: 'Token is required' }).max(256);

export const confirmPasswordSchema = z.string().meta({ description: 'Must equal the new password', example: 'MyNewSecurePassword123' });

/** Refinement for `.refine()`: `confirmPassword` must equal the given password field. */
export const passwordsMatch = <K extends string>(field: K): [(data: Record<K | 'confirmPassword', string>) => boolean, { message: string; path: string[] }] => [
  (data) => data[field] === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] },
];

/** A 6-digit code sent by email. */
export const otpSchema = z
  .string()
  .regex(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  .meta({ description: 'The 6-digit code sent to your email', example: '123456' });