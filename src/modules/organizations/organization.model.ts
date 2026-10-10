import { OrganizationTypes } from '@common/enums/organizations.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose'; 
@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Organization {

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  organizationOwner: Types.ObjectId | null;


  @Prop({ type: String, enum: OrganizationTypes })
  organizationType: OrganizationTypes;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
