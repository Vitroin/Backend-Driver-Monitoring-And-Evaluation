import { Prop, Schema } from "@nestjs/mongoose";
import { TripStatus } from "./trip_status.enum";

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})

export class Trip {
  @Prop({ required: true })
  vehicle: string;

  @Prop({ required: true, type: String, enum: TripStatus, default: TripStatus.PLANNED })
  status: TripStatus;
  
  @Prop({ required: false, default: 0 })
  duration: number;
  
  @Prop({ required: false, default: 0 })
  distance: number;

  @Prop({ required: false, default: 0 })
  topSpeed: number;

  @Prop({ required: false, default: 0 })
  eventsCounter: number;

  @Prop({ required: false, default: 0 })
  risk: number;
}