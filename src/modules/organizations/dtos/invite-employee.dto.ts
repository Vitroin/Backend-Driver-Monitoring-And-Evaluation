import { CreateUserSchema } from '@modules/users/create-user.dto';
import { z } from 'zod';

/**
 * The details of someone invited into an organization (an employee or a driver), validated the same way as when
 * creating a user. Their role comes from the route and the organization's type (EMPLOYEE_ROLES), never from the body.
 */
export const InviteMemberSchema = CreateUserSchema.pick({ fullName: true, email: true, age: true, gender: true });
export type InviteMemberDto = z.infer<typeof InviteMemberSchema>;
