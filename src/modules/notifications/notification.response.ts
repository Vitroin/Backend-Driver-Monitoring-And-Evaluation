import { z } from 'zod';
import { NotificationType } from '@common/enums';
import { paginationQueryShape, objectIdSchema } from '@common/types';

export const listNotificationsQuerySchema = z.strictObject({
  unread: z.stringbool().default(false).meta({ description: 'Only the unread ones ("Unread" tab)' }),
  ...paginationQueryShape,
});
export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;

export const notificationSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  recipient: objectIdSchema,
  type: z.enum(NotificationType),
  trip: objectIdSchema.nullable().meta({ description: 'What the notification opens; null for system updates' }),
  incident: objectIdSchema.nullable(),
  params: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .meta({ description: 'Values for the message, which the client builds in the user\'s language', example: { tripCode: 'T-10001', score: 90 } }),
  readAt: z.iso.datetime().nullable().meta({ description: 'null while unread' }),
  createdAt: z.iso.datetime().meta({ example: '2026-10-22T09:30:00.000Z' }),
  updatedAt: z.iso.datetime().meta({ example: '2026-10-22T09:30:00.000Z' }),
});

export const markedAllReadSchema = z.object({ updated: z.number().int().meta({ description: 'How many were unread', example: 3 }) });
