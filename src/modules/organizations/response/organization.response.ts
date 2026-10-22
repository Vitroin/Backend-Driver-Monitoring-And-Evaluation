import { z } from 'zod';
import { objectIdSchema } from '@common/types';
import { OrganizationTypes } from '../organizations.enum';

export const organizationResponseSchema = z.object({
  _id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  id: objectIdSchema.meta({ description: 'Same as _id', example: '665f1c2e8b3e4a1d2c9f0a12' }),
  name: z.string().meta({ example: 'Cairo Driving School' }),
  organizationType: z.enum(OrganizationTypes),
  organizationOwner: objectIdSchema.nullable().meta({ description: "The owner's user id", example: '665f1c2e8b3e4a1d2c9f0a13' }),
  createdAt: z.iso.datetime().meta({ example: '2026-10-22T09:30:00.000Z' }),
});
export type OrganizationResponseDto = z.infer<typeof organizationResponseSchema>;

// These routes answer { success, data } rather than the usual { message, data } (BaseResponseSchema)
export const organizationListResponseSchema = z.object({
  success: z.boolean(),
  data: organizationResponseSchema.array(),
});

// The created organization is returned whole, so it also has updatedAt and Mongoose's version key
export const createdOrganizationResponseSchema = z.object({
  success: z.boolean(),
  data: organizationResponseSchema.extend({
    updatedAt: z.iso.datetime().meta({ example: '2026-10-22T09:30:00.000Z' }),
    __v: z.number().meta({ example: 0 }),
  }),
});
