import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { IncidentsModule } from './incidents/incidents.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';
import { FastApiModule } from './fast-api/fast-api.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { InstructorsModule } from './instructors/instructors.module';

const modules = [UsersModule, OrganizationsModule, AuthModule, TripsModule, IncidentsModule, FastApiModule, NotificationsModule, ReportsModule, InstructorsModule];

@Module({
  imports: modules,
  exports: modules,
})
export class FeaturesModule {}