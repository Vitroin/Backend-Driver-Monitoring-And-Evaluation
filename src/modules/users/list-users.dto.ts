import { UserRole } from '@common/enums';
import { objectIdSchema, paginationQueryShape } from '@common/types';
import { z } from 'zod';

export const listUsersQuerySchema = z.strictObject({
  role: z.enum(UserRole).optional(),
  organizationId: objectIdSchema.optional(),
  ...paginationQueryShape,
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;

/** A driver's id in a route, or `me` for the logged-in driver. */
export const driverIdParamSchema = z.object({
  driverId: z.union([z.literal('me'), objectIdSchema]).meta({ description: 'A driver id, or `me`', example: 'me' }),
});
export type DriverIdParam = z.infer<typeof driverIdParamSchema>;
