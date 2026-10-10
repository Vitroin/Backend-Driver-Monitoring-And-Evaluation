import { Roles } from '@common/enums/roles.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class User {
  @Prop({ required: true, unique: true, index: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  age: number;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  orgranization: Types.ObjectId;

  @Prop({ type: String, enum: Roles, required: true })
  role: Roles;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Create a compound index on the email and organization fields to ensure uniqueness
UserSchema.index({ email: 1, organization: 1 }, { unique: true });
