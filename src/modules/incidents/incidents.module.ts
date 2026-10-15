import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncidentsController } from './incidents.controller';
import { IncidentSchema } from './incidents.model';
import { IncidentsService } from './incidents.service';
import { IncidentsRepository } from './incidents.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Incident', schema: IncidentSchema }])],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsRepository],
})
export class IncidentsModule {}
