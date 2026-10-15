import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { TripsModule } from './trips/trips.module';
import { IncidentsModule } from './incidents/incidents.module';

const modules = [
  UsersModule,
  OrganizationsModule,
  AuthModule
  
];

@Module({
  imports: modules,
  exports: modules,
})
export class FeaturesModule {}
