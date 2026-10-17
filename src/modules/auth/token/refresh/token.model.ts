import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

/*
 * One session's refresh token. Its `id` is the `sid` of every access token issued in the session.
 * Refreshing rotates `tokenHash` (and `expiresAt`) in place, so the row and the `sid` live as long as the session.
 */
@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class RefreshToken {
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  securityStamp: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// MongoDB deletes the document automatically once expiresAt has passed
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
