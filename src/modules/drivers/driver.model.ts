import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

// A driver document is a User with role "driver" plus the fields below
export type DriverDocument = HydratedDocument<User & Driver>;

/*
 * Fields only drivers have. Stored in the users collection (Mongoose discriminator on `role`),
 * so login, refresh tokens and email uniqueness work exactly like for every other user.
 * Doesn't extend User: SchemaFactory would copy User's fields here, including `role`, which Mongoose rejects.
 * Schema options (timestamps, toJSON...) come from the User schema.
 */
@Schema()
export class Driver {
  @Prop({ type: String, default: null })
  licenseNumber: string | null;

  // The driving-school instructor who evaluates this driver
  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  instructor: Types.ObjectId | null;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);