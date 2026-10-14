import { CreateUserSchema } from '@modules/users/create-user.dto';
import type { z } from 'zod';

/** Inviting a user takes the same fields as creating one; the password is set by the user when they accept. */
export const inviteUserSchema = CreateUserSchema;

export type InviteUserDto = z.infer<typeof inviteUserSchema>;