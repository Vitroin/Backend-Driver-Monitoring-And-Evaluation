import { Module } from '@nestjs/common';
import { IncidentsModule } from '@modules/incidents/incidents.module';
import { TripsModule } from '@modules/trips/trips.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [TripsModule, IncidentsModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
