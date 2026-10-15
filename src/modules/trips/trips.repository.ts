import { BaseRepository } from "@common/repositories";
import { Injectable } from "@nestjs/common";
import { Trip } from "./trips.model";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

@Injectable()
export class TripsRepository extends BaseRepository<Trip>{
  constructor(@InjectModel(Trip.name) private readonly tripModel: Model<Trip>){
    super(tripModel);
  }
}