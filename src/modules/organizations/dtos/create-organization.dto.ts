import { OrganizationTypes } from '@modules/organizations/organizations.enum';
import { CreateUserSchema } from '@modules/users/create-user.dto';
import { objectIdSchema } from '@common/types';
import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z
    .string({ message: 'Name is required' })
    .trim()
    .min(2, { message: 'Name must be at least 2 characters long' })
    .max(100, { message: 'Name must be at most 100 characters long' }),

  organizationType: z.enum(OrganizationTypes, {
    message: `Organization type must be one of: ${Object.values(OrganizationTypes).join(', ')}`,
  }),

  organizationOwner: objectIdSchema.optional(),

  // Owner's user fields, validated the same way as when creating a user
  ...CreateUserSchema.pick({ fullName: true, email: true, age: true, gender: true}).shape,
});

export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
