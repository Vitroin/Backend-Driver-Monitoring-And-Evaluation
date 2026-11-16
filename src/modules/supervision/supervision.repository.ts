import { BaseRepository } from "@common/repositories"
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Supervision } from "./supervision.model";
import { Model } from "mongoose";

@Injectable()
export class SupervisionRepository extends BaseRepository<Supervision> {
  constructor( @InjectModel('Supervision') private readonly supervisionModel: Model<Supervision>) {
    super(supervisionModel);
  }

  
}