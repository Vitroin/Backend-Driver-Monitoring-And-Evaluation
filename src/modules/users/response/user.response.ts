import { z } from 'zod';
import { UserRole, UserStatus } from '@common/enums';
import { objectIdSchema } from '@common/types';
import { OrganizationTypes } from '@modules/organizations/organizations.enum';

// A user in the super admin's user list: only the fields that are safe to show
export const userListItemSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a14' }),
  username: z.string().meta({ example: 'jane-doe-k3x9q' }),
  fullName: z.string().meta({ example: 'Jane Doe' }),
  email: z.email().meta({ example: 'jane.doe@mail.com' }),
  role: z.enum(UserRole),
  status: z.enum(UserStatus),
  organization: objectIdSchema.nullable().meta({ description: 'null for super admins' }),
  createdAt: z.iso.datetime().meta({ example: '2026-10-22T09:30:00.000Z' }),
});

export const userOrganizationSchema = z
  .object({
    id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
    name: z.string().meta({ example: 'Cairo Driving School' }),
    organizationType: z.enum(OrganizationTypes),
  })
  .nullable()
  .meta({ description: 'null for super admins' });
export type UserOrganizationDto = z.infer<typeof userOrganizationSchema>;
