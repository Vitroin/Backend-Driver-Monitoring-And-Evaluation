import { InjectModel } from '@nestjs/mongoose';
import { BaseRepository } from "@common/repositories";
import { Injectable } from "@nestjs/common";
import { Driver } from "./driver.model";
import { Model } from 'mongoose';

@Injectable()
export class DriversRepository extends BaseRepository<Driver>{
  constructor(@InjectModel(Driver.name) private readonly driverModel: Model<Driver>) {
    super(driverModel);
  }
}