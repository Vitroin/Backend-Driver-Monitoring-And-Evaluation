import { OrganizationTypes } from '@modules/organizations/organizations.enum';
import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';


@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Organization {
  @Prop({ required: true })
  name: string;

  // @Prop({ required: true, unique: true, index: true })
  // slug: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  organizationOwner: Types.ObjectId | null;

  @Prop({ type: String, enum: OrganizationTypes })
  organizationType: OrganizationTypes;


  organizationDrivers?: User[];

  organizationEmployees?: User[];
}


export const OrganizationSchema = SchemaFactory.createForClass(Organization);

// One owner can't have two organizations with the same name, ignoring case ("Cairo School" = "cairo school").
// Organizations without an owner aren't checked
OrganizationSchema.index(
  { name: 1, organizationOwner: 1 },
  {
    unique: true,
    partialFilterExpression: { organizationOwner: { $type: 'objectId' } },
    collation: { locale: 'en', strength: 2 },
  },
);

OrganizationSchema.virtual('organizationDrivers', {
  ref: User.name,
  localField: '_id',
  foreignField: 'User',
  options: { sort: { occurredAt: 1 } },
  autopopulate: true,
});

OrganizationSchema.virtual('organizationEmployees', {
  ref: User.name,
  localField: '_id',
  foreignField: 'organization',
  options: { sort: { occurredAt: 1 } },
  autopopulate: true,
});