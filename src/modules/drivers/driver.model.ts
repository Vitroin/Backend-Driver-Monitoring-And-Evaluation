import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type DriverDocument = HydratedDocument<Driver>;
/*
 * Fields only drivers have. Stored in the users collection (Mongoose discriminator on `role`),
 * so login, refresh tokens and email uniqueness work exactly like for every other user.
 * Doesn't extend User: SchemaFactory would copy User's fields here, including `role`, which Mongoose rejects.
 * Schema options (timestamps, toJSON...) come from the User schema.
 */
@Schema()
export class Driver extends User {
  @Prop({ type: String, default: null })
  licenseNumber: string | null;

  // The driving-school instructor who evaluates this driver
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, default: null })
  instructor: Types.ObjectId | null;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);

// `role` is the discriminator key; Mongoose sets it to 'driver' itself and refuses a discriminator that defines it
DriverSchema.remove('role');
