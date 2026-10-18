import { NotificationType } from '@common/enums';
import { objectIdSchema } from '@common/types';
import { z } from 'zod';

/*
 * One notification for one user. The backend creates these itself (a trip finished processing,
 * a high-risk event, a system update); the client never sends one.
 */
export const CreateNotificationSchema = z
  .strictObject({
    recipient: objectIdSchema.meta({ description: 'User ID' }),

    type: z.enum(NotificationType, {
      message: `Type must be one of: ${Object.values(NotificationType).join(', ')}`,
    }),

    trip: objectIdSchema.nullable().default(null).meta({ description: 'Trip ID' }),

    incident: objectIdSchema.nullable().default(null).meta({ description: 'Incident ID' }),

    params: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .default({})
      .meta({ description: 'Values for the message, e.g. { driverName: "Youssef Nabil", score: 90 }' }),
  })
  .refine(({ type, trip }) => type === NotificationType.SYSTEM_UPDATE || trip !== null, {
    message: 'Trip reports and high-risk events need a trip',
    path: ['trip'],
  })
  .refine(({ type, incident }) => type !== NotificationType.HIGH_RISK_EVENT || incident !== null, {
    message: 'High-risk events need an incident',
    path: ['incident'],
  });

export type CreateNotificationDto = z.infer<typeof CreateNotificationSchema>;

// What callers pass in: trip, incident and params can be left out and get their defaults
export type CreateNotificationInput = z.input<typeof CreateNotificationSchema>;
