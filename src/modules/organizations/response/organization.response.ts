import { z } from 'zod';
import { objectIdSchema } from '@common/types';
import { UserRole, UserStatus } from '@common/enums';
import { OrganizationTypes } from '../organizations.enum';

export const organizationResponseSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  name: z.string().meta({ example: 'Cairo Driving School' }),
  organizationType: z.enum(OrganizationTypes),
  organizationOwner: objectIdSchema.nullable().meta({ description: "The owner's user id", example: '665f1c2e8b3e4a1d2c9f0a13' }),
  createdAt: z.iso.datetime().meta({ example: '2026-10-22T09:30:00.000Z' }),
});
export type OrganizationResponseDto = z.infer<typeof organizationResponseSchema>;

// The whole organization document, as returned when one is created or opened
export const organizationDetailsSchema = organizationResponseSchema.extend({
  updatedAt: z.iso.datetime().meta({ example: '2026-10-22T09:30:00.000Z' }),
});

// A driver or employee as listed in their organization: only the fields that are safe to show
export const organizationMemberSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a14' }),
  username: z.string().meta({ example: 'jane-doe-k3x9q' }),
  fullName: z.string().meta({ example: 'Jane Doe' }),
  email: z.email().meta({ example: 'jane.doe@mail.com' }),
  role: z.enum(UserRole),
  status: z.enum(UserStatus),
});
export type OrganizationMemberDto = z.infer<typeof organizationMemberSchema>;

// One organization with its drivers and employees
export const organizationWithMembersSchema = organizationDetailsSchema.extend({
  organizationDrivers: organizationMemberSchema.array(),
  organizationEmployees: organizationMemberSchema
    .array()
    .meta({ description: 'Everyone in the organization except drivers, the owner included' }),
});
