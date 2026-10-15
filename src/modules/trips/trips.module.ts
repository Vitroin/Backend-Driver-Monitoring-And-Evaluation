import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TripSchema } from './trips.model';
import { TripsRepository } from './trips.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Trip', schema: TripSchema }])],
  controllers: [TripsController],
  providers: [TripsService, TripsRepository],
})
export class TripsModule {}
