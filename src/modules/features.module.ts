import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AuthModule } from './auth/auth.module';

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
