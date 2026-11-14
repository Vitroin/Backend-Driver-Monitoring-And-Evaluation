import { IncidentSeverity, IncidentType } from '@common/enums';
import { Types } from 'mongoose';
import { Incident } from './incidents.model';

// One incident as returned by the repository queries
export type IncidentRow = Pick<
  Incident,
  'trip' | 'type' | 'severity' | 'occurredAt' | 'location' | 'speedKmh' | 'clipUrl' | 'pointsDeducted'
> & { _id: Types.ObjectId };

// What findOverview returns: the top incidents + counts for all matching incidents
export type IncidentOverview = {
  incidents: IncidentRow[];
  total: number;
  byType: { type: IncidentType; count: number; pointsLost: number }[];
};

// findOverview's input
export type IncidentOverviewFilter = {
  driver: string | Types.ObjectId;
  trip?: string | Types.ObjectId;
  since?: Date;
  severities?: IncidentSeverity[];
};

// findByTrip's input (trip map)
export type TripIncidentFilter = {
  eventType?: IncidentType;
  severity?: IncidentSeverity;
  driver?: string | Types.ObjectId; // only this driver's incidents (ownership check)
};
