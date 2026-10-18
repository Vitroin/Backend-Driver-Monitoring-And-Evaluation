import { FastApiModule } from '@modules/fast-api/fast-api.module';
import { IncidentsModule } from '@modules/incidents/incidents.module';
import { TripsModule } from '@modules/trips/trips.module';
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [IncidentsModule, TripsModule, FastApiModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
