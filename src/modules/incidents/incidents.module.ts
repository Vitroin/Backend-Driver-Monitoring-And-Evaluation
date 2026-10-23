import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncidentsController } from './incidents.controller';
import { Incident, IncidentSchema } from './incidents.model';
import { IncidentsRepository } from './incidents.repository';
import { IncidentsService } from './incidents.service';
import { AppCacheModule } from '@infrastructure/cache';

@Module({
  imports: [MongooseModule.forFeature([{ name: Incident.name, schema: IncidentSchema }]), AppCacheModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsRepository],
  exports: [IncidentsService],
})
export class IncidentsModule {}