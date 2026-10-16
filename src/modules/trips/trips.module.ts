import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncidentsModule } from '@modules/incidents/incidents.module';
import { TripMapController } from './trip-map.controller';
import { TripMapService } from './trip-map.service';
import { TripRoutePoint, TripRoutePointSchema } from './trip-route-point.model';
import { TripRouteRepository } from './trip-route.repository';
import { TripsController } from './trips.controller';
import { Trip, TripSchema } from './trips.model';
import { TripsRepository } from './trips.repository';
import { TripsService } from './trips.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Trip.name, schema: TripSchema },
      { name: TripRoutePoint.name, schema: TripRoutePointSchema },
    ]),
    IncidentsModule,
  ],
  controllers: [TripsController, TripMapController],
  providers: [TripsService, TripsRepository, TripMapService, TripRouteRepository],
  exports: [TripsService],
})
export class TripsModule {}
