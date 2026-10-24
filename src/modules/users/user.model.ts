import { Gender, Language, UserRole, UserStatus } from '@common/enums';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

// Ids are declared with SchemaTypes.ObjectId, not Types.ObjectId: @nestjs/mongoose treats the Types.ObjectId class
// as a nested schema and stores the path as Mixed, so string ids in filters would never match.
@Schema({
  timestamps: true,
  discriminatorKey: 'role',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  // "How your name appears to evaluators and in reports" (Youssef Nabil, the YN avatar)
  @Prop({ required: true, trim: true })
  fullName: string;

  // Stored on the server because the in-vehicle unit uses it for voice prompts
  @Prop({ type: String, enum: Language, default: Language.ENGLISH })
  language: Language;

  // Set by "Request deletion"; an admin or a scheduled job then deletes the account and its data
  @Prop({ type: Date, default: null })
  deletionRequestedAt: Date | null;

  // Never loaded unless a query asks for it with .select('+passwordHash'), so it can't leak into a response
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true, default: () => new Types.ObjectId() })
  securityStamp: Types.ObjectId;

  @Prop({ type: Number, required: true })
  age: number;

  @Prop({ type: String, enum: Gender, required: true })
  gender: Gender;

  @Prop({ required: true, type: String, enum: UserStatus, default: UserStatus.WAITING_FOR_ACTIVATION })
  status: UserStatus;

  // null only for super admins, who don't belong to an organization
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Organization', default: null })
  organization: Types.ObjectId | null;

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole;

  @Prop({ default: true })
  mustChangePassword: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// An email can be used once per organization
UserSchema.index({ email: 1, organization: 1 }, { unique: true });
