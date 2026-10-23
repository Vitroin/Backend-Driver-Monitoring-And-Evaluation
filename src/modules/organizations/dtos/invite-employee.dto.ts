import { CreateUserSchema } from '@modules/users/create-user.dto';
import { z } from 'zod';

/** The employee's details, validated the same way as when creating a user. Their role comes from the organization's type (EMPLOYEE_ROLES). */
export const InviteEmployeeSchema = CreateUserSchema.pick({ fullName: true, email: true, age: true, gender: true });

export type InviteEmployeeDto = z.infer<typeof InviteEmployeeSchema>;
