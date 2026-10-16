import { z } from 'zod';

/** Usernames are globally unique and stored lowercase, so normalise before validating or looking up. */
export const usernameSchema = z
  .string({ message: 'Username is required' })
  .trim()
  .toLowerCase()
  .min(3, { message: 'Username must be at least 3 characters long' })
  .max(30, { message: 'Username must be at most 30 characters long' })
  .meta({ description: 'Unique username', example: 'jane.doe' });

/** Trimmed and lowercased first, then checked, so " Jane@Mail.com " is accepted and stored as "jane@mail.com". */
export const emailSchema = z
  .string({ message: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Email must be a valid email address' }).max(255))
  .meta({ example: 'jane@example.com' });

/** "How your name appears to evaluators and in reports". */
export const fullNameSchema = z
  .string({ message: 'Full name is required' })
  .trim()
  .min(2, { message: 'Full name is too short' })
  .max(100, { message: 'Full name is too long' })
  .meta({ example: 'Youssef Nabil' });
