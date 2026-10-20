import { Language } from '@common/enums';
import { UserRole } from '@common/enums/user/user_roles.enum';
import { UserStatus } from '@common/enums/user/user_status.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  discriminatorKey: 'role',
  toObject: { virtuals: true },
})
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true })
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

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, lowercase: true })
  email: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true, default: () => new Types.ObjectId() })
  securityStamp: Types.ObjectId;

  @Prop({ required: true })
  age: number;

  @Prop({ required: true })
  gender: string;

  @Prop({ required: true, type: String, enum: UserStatus, default: UserStatus.WAITING_FOR_ACTIVATION })
  status: UserStatus;

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Organization' })
  organization: Types.ObjectId[];

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole;

  @Prop({ default: true })
  mustChangePassword: boolean;

}

export const UserSchema = SchemaFactory.createForClass(User);

// Create a compound index on the email and organization fields to ensure uniqueness
UserSchema.index({ email: 1, organization: 1 }, { unique: true });
