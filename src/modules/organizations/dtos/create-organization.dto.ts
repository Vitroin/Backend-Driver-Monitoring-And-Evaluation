import { OrganizationTypes } from '@modules/organizations/organizations.enum';
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
});

export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
