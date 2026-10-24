import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { FastApiModule } from './fast-api/fast-api.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { InstructorsModule } from './instructors/instructors.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ReportsModule } from './reports/reports.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';

const modules = [
  UsersModule,
  OrganizationsModule,
  AuthModule,
  TripsModule,
  IncidentsModule,
  DriversModule,
  FastApiModule,
  NotificationsModule,
  ReportsModule,
  InstructorsModule,
  HealthModule,
];

@Module({
  imports: modules,
  exports: modules,
})
export class FeaturesModule {}
