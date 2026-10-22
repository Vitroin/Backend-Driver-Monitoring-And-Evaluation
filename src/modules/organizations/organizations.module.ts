import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { Organization, OrganizationSchema } from './organization.model';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationsRepository } from './organization.repository';
import { OrganizationsFactory } from './organization.factory';

@Module({
  imports: [MongooseModule.forFeature([{ name: Organization.name, schema: OrganizationSchema }])],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository, OrganizationsFactory],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
