import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { IncidentsModule } from './incidents/incidents.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';
import { FastApiModule } from './fast-api/fast-api.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';

const modules = [UsersModule, OrganizationsModule, AuthModule, DriversModule, TripsModule, IncidentsModule, FastApiModule, NotificationsModule, ReportsModule];

@Module({
  imports: modules,
  exports: modules,
})
export class FeaturesModule {}