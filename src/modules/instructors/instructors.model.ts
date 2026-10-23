import { User } from '@modules/users/user.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type InstructorDocument = HydratedDocument<Instructor>;
/*
 * Fields only instructors have. Stored in the users collection (Mongoose discriminator on `role`),
 * so login, refresh tokens and email uniqueness work exactly like for every other user.
 * Schema options (timestamps, toJSON...) come from the User schema.
 */
@Schema()
export class Instructor extends User {
  // The drivers (learners) this instructor teaches and evaluates
  @Prop({ type: [SchemaTypes.ObjectId], ref: User.name, default: [] })
  drivingStudents: Types.ObjectId[];
}

export const InstructorSchema = SchemaFactory.createForClass(Instructor);

// `role` is the discriminator key; Mongoose sets it to 'driver_instructor' itself and refuses a discriminator that defines it
InstructorSchema.remove('role');
