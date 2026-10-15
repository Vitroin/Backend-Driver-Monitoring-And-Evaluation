import { Organization } from '@modules/organizations/organization.model';
import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { TripRisk, TripStatus } from '@common/enums';
import { riskForScore } from './trip-scoring';


export type TripDocument = HydratedDocument<Trip>;

// Score thresholds for the risk badge (the "Low risk" / "High risk" lines on the score history chart)
const LOW_RISK_MIN_SCORE = 85;
const MEDIUM_RISK_MIN_SCORE = 65;

/*
 * One drive by one driver. Measurements and the score stay null until the trip has been processed,
 * so a planned trip shows "—" instead of 0 and doesn't pull the driver's averages down.
 */
@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Trip {
  // Human-readable id shown in the list, e.g. T-24013
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name, required: true })
  driver: Types.ObjectId;

  // Copied from the driver so an organization's trips can be listed with one query
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Organization.name, required: true })
  organization: Types.ObjectId;

  @Prop({ required: true })
  vehicle: string;

  @Prop({ required: true, type: String, enum: TripStatus, default: TripStatus.PLANNED })
  status: TripStatus;

  // Planned start while the trip is PLANNED, actual start once recording begins
  @Prop({ required: true })
  startedAt: Date;

  // Set when the trip is planned; speeding incidents are measured against it
  @Prop({ type: Number, default: null })
  speedLimitKmh: number | null;

  @Prop({ type: Number, default: null })
  durationSeconds: number | null;

  @Prop({ type: Number, default: null })
  distanceKm: number | null;

  @Prop({ type: Number, default: null })
  averageSpeedKmh: number | null;

  @Prop({ type: Number, default: null })
  topSpeedKmh: number | null;

  // Incidents that count toward the score (dismissed ones excluded)
  @Prop({ type: Number, default: null })
  eventsCount: number | null;

  // 100 minus the pointsDeducted of the trip's counted incidents
  @Prop({ type: Number, default: null, min: 0, max: 100 })
  score: number | null;

  // Virtual, derived from score (see TripSchema.virtual below)
  risk: TripRisk | null;

  createdAt: Date;
  updatedAt: Date;
}

export const TripSchema = SchemaFactory.createForClass(Trip);

TripSchema.virtual('risk').get(function (this: TripDocument): TripRisk | null {
  return typeof this.score === 'number' ? riskForScore(this.score) : null;
});
// A driver's trips, newest first (trip list and progress page)
TripSchema.index({ driver: 1, startedAt: -1 });

// All trips in an organization, newest first (analysts / instructors)
TripSchema.index({ organization: 1, startedAt: -1 });
