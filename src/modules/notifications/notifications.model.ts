import { NotificationType } from '@common/enums';
import { Incident } from '@modules/incidents/incidents.model';
import { Trip } from '@modules/trips/trips.model';
import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

/*
 * One entry on the notifications page (new reports, high-risk events and system updates).
 * Read state belongs to the recipient, so an event that concerns several users (the driver and their instructor)
 * creates one notification for each of them.
 */
@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Notification {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  recipient: Types.ObjectId;

  // Picks the icon and the title ("Trip report ready")
  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  // What the notification opens: the trip report, plus the event itself for a high-risk event; null for system updates
  @Prop({ type: SchemaTypes.ObjectId, ref: Trip.name, default: null })
  trip: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: Incident.name, default: null })
  incident: Types.ObjectId | null;

  // Values for the message, e.g. { driverName: 'Youssef Nabil', score: 90 } for "Youssef Nabil's trip scored 90/100."
  // The client builds the text in the user's current language (English / Arabic), so only the values are stored.
  // They're kept as they were when it was sent, so the message doesn't change if the driver is renamed or the trip rescored
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  params: Record<string, string | number>;

  // null while unread (the blue dot, the bell badge and the "Unread" tab); set by opening it or "Mark all as read"
  @Prop({ type: Date, default: null })
  readAt: Date | null;

  // When it was sent (the "8 days ago · 10 Oct, 12:33")
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// "All" tab: a user's notifications, newest first
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// "Unread" tab, the unread count and "Mark all as read" ({ recipient, readAt: null })
NotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
