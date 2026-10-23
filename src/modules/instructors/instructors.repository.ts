import { Instructor } from './instructors.model';
import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class InstructorsRepository extends BaseRepository<Instructor> {
  constructor(@InjectModel(Instructor.name) private readonly instructorModel: Model<Instructor>) {
    super(instructorModel);
  }
}
