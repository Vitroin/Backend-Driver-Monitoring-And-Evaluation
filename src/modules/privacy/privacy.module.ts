import { IncidentsModule } from '@modules/incidents/incidents.module';
import { OrganizationsModule } from '@modules/organizations/organizations.module';
import { TripsModule } from '@modules/trips/trips.module';
import { UsersModule } from '@modules/users/users.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { Consent, ConsentSchema } from './consent.model';
import { ConsentsRepository } from './consent.repository';

/** The "Privacy & data sharing" page: consents, "Download my data" and "Request deletion". */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Consent.name, schema: ConsentSchema }]),
    OrganizationsModule, 
    TripsModule, 
    IncidentsModule, 
    UsersModule, 
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService, ConsentsRepository],
  exports: [PrivacyService],
})
export class PrivacyModule {}