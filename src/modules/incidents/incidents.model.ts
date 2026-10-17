import { IncidentSeverity, IncidentType } from '@common/enums';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IncidentDocument = HydratedDocument<Incident>;

// WGS84 coordinates, as reported by the in-vehicle GPS receiver
@Schema({ _id: false })
export class IncidentLocation {
  @Prop({ required: true, min: -90, max: 90 })
  latitude: number;

  @Prop({ required: true, min: -180, max: 180 })
  longitude: number;
}

const IncidentLocationSchema = SchemaFactory.createForClass(IncidentLocation);

/*
 * One event detected during a trip (e.g. harsh braking, eye closure).
 * The trip report is built from these: event counts per type, points lost per category and the top events.
 */
@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Incident {
  @Prop({ type: Types.ObjectId, ref: 'Trip', required: true })
  trip: Types.ObjectId;

  // Copied from the trip so a driver's incidents can be queried without going through their trips
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  driver: Types.ObjectId;

  @Prop({ type: String, enum: IncidentType, required: true })
  type: IncidentType;

  @Prop({ type: String, enum: IncidentSeverity, required: true })
  severity: IncidentSeverity;

  // When the event happened (the 12:27 in the report), not when the document was saved
  @Prop({ required: true })
  occurredAt: Date;

  // Where the vehicle was when the event was detected; null without a GPS fix,
  // so the incident is still shown on the timeline but not placed on the map
  @Prop({ type: IncidentLocationSchema, default: null })
  location: IncidentLocation | null;

  // Vehicle speed when the event was detected; null when it wasn't recorded
  @Prop({ type: Number, default: null, min: 0 })
  speedKmh: number | null;

  // Short event clip on Cloudinary; publicId is what you need to delete it after 90 days
  @Prop({ type: String, default: null })
  clipUrl: string | null;

  @Prop({ type: String, default: null })
  clipPublicId: string | null;

  // Stored as a positive number; the report shows it as -5.6
  @Prop({ required: true, min: 0 })
  pointsDeducted: number;

  createdAt: Date;
  updatedAt: Date;
}

export const IncidentSchema = SchemaFactory.createForClass(Incident);

// Trip report: all incidents of a trip in chronological order
IncidentSchema.index({ trip: 1, occurredAt: 1 });

// Driver history: a driver's incidents across trips, newest first
IncidentSchema.index({ driver: 1, occurredAt: -1 });
