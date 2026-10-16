import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type TripRoutePointDocument = HydratedDocument<TripRoutePoint>;

/*
 * One GPS fix recorded during a trip; the trip map draws the route through them.
 * Its own collection instead of an array on the trip: a 90-minute trip at 1 Hz is ~5,400 points,
 * and trip documents are loaded whole by the trip lists.
 */
@Schema({ versionKey: false })
export class TripRoutePoint {
  @Prop({ type: Types.ObjectId, ref: 'Trip', required: true })
  trip: Types.ObjectId;

  // When the in-vehicle unit took the fix
  @Prop({ required: true })
  recordedAt: Date;

  // WGS84, as reported by the GPS receiver
  @Prop({ required: true, min: -90, max: 90 })
  latitude: number;

  @Prop({ required: true, min: -180, max: 180 })
  longitude: number;

  // Measured vehicle speed; null when the reading is missing (never assumed to be 0)
  @Prop({ type: Number, default: null, min: 0 })
  speedKmh: number | null;

  // Posted limit at this location, filled in when trip processing has a road speed-limit source.
  // null means unknown here, and the trip's speedLimitKmh applies.
  @Prop({ type: Number, default: null, min: 0 })
  speedLimitKmh: number | null;

  // Direction of travel, degrees clockwise from north; null when not reported
  @Prop({ type: Number, default: null, min: 0, max: 360 })
  headingDeg: number | null;
}

export const TripRoutePointSchema = SchemaFactory.createForClass(TripRoutePoint);

// The route in chronological order. Unique, so a re-uploaded batch of fixes can't duplicate points.
TripRoutePointSchema.index({ trip: 1, recordedAt: 1 }, { unique: true });
