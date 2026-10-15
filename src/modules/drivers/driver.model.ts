import { Trip } from "@modules/trips/trips.model";
import { User } from "@modules/users/user.model";
import { Prop, Schema } from "@nestjs/mongoose";

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})

export class Driver extends User {
  @Prop({ required: true, default: 0 })
  Trips: Trip[];
  



}
