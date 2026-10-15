import { ConsentScope } from '@common/enums';
import { Organization } from '@modules/organizations/organization.model';
import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type ConsentDocument = HydratedDocument<Consent>;

/*
 * A driver's permission for another organization (e.g. an insurer) to see part of their data (SRS FR-AUT-10).
 * "Stop sharing" sets revokedAt instead of deleting, so the driver keeps a history of what was shared and when.
 */
@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Consent {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name, required: true })
  driver: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Organization.name, required: true })
  organization: Types.ObjectId;

  @Prop({ type: [{ type: String, enum: ConsentScope }], required: true })
  scopes: ConsentScope[];

  // "Shared since"; it stays the same when the driver later changes what is shared
  @Prop({ type: Date, default: () => new Date() })
  grantedAt: Date;

  // null while the consent is active; access stops as soon as it is set
  @Prop({ type: Date, default: null })
  revokedAt: Date | null;
}

export const ConsentSchema = SchemaFactory.createForClass(Consent);

// At most one active consent per driver and organization; revoked ones stay as history
ConsentSchema.index(
  { driver: 1, organization: 1 },
  { unique: true, partialFilterExpression: { revokedAt: { $type: 'null' } } },
);

// "Who can see my data": a driver's consents, newest first
ConsentSchema.index({ driver: 1, grantedAt: -1 });