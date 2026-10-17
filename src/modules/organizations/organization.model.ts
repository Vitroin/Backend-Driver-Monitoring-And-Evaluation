import { OrganizationTypes } from '@modules/organizations/organizations.enum';
import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { SchemaTypes, Types } from 'mongoose';
@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Organization {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  organizationOwner: Types.ObjectId | null;

  @Prop({ type: String, enum: OrganizationTypes })
  organizationType: OrganizationTypes;

  organizationDrivers?: User[];
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.virtual('organizationDrivers', {
  ref: User.name,
  localField: '_id',
  foreignField: 'User',
  options: { sort: { occurredAt: 1 } },
  autopopulate: true,
});
