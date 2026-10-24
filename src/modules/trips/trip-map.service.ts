import { IncidentCategory } from '@common/enums';
import { INCIDENT_CATEGORY } from '@modules/incidents/incident-category';
import { IncidentsService } from '@modules/incidents/incidents.service';
import type { TripIncidentFilter, TripIncidentOptions } from '@modules/incidents/incidents.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { IncidentMarkerDto, RoutePointDto, TimelineEventDto, TripMapDto, TripRouteDto } from './response';
import { buildSpeedSegments, classifySpeed, DEFAULT_NEAR_LIMIT_TOLERANCE_PERCENT, resolveSpeedLimit, sampleRoute } from './trip-route';
import { TripRouteRepository, type RouteTimeRange } from './trip-route.repository';
import type { TripIncidentsQueryDto, TripMapQueryDto, TripRouteQueryDto } from './trip_map.dto';
import { TripsRepository, type MapTripRow } from './trips.repository';

const secondsSince = (start: Date, at: Date): number => (at.getTime() - start.getTime()) / 1000;

const INCIDENT_SORTS: Record<TripIncidentsQueryDto['sort'], TripIncidentOptions['sort']> = {
  occurredAt: { occurredAt: 1 },
  '-pointsDeducted': { pointsDeducted: -1, occurredAt: 1 },
};

// The trip page's map: the GPS route coloured by speed, the incident markers, and the timeline under it
@Injectable()
export class TripMapService {
  constructor(
    private readonly tripsRepository: TripsRepository,
    private readonly tripRouteRepository: TripRouteRepository,
    private readonly incidentsService: IncidentsService,
  ) {}

  async getRoute(tripId: Types.ObjectId, query: TripRouteQueryDto): Promise<TripRouteDto> {
    const trip = await this.findTrip(tripId);
    return this.buildRoute(trip, query);
  }

  async getIncidents(tripId: Types.ObjectId, { eventType, severity, sort, limit }: TripIncidentsQueryDto): Promise<IncidentMarkerDto[]> {
    const trip = await this.findTrip(tripId);
    return this.buildIncidentMarkers(trip, { eventType, severity }, { sort: INCIDENT_SORTS[sort], limit });
  }

  async getMap(tripId: Types.ObjectId, { maxPoints }: TripMapQueryDto): Promise<TripMapDto> {
    const trip = await this.findTrip(tripId);
    const [route, incidents] = await Promise.all([this.buildRoute(trip, { maxPoints }), this.buildIncidentMarkers(trip)]);

    const durationSeconds = trip.durationSeconds ?? null;
    return {
      trip: {
        id: trip._id.toString(),
        code: trip.code,
        status: trip.status,
        startedAt: trip.startedAt.toISOString(),
        endedAt: durationSeconds === null ? null : new Date(trip.startedAt.getTime() + durationSeconds * 1000).toISOString(),
        durationSeconds,
        distanceKm: trip.distanceKm ?? null,
        speedLimitKmh: trip.speedLimitKmh ?? null,
      },
      route,
      incidents,
      timeline: {
        drivingActions: this.timelineRow(incidents, IncidentCategory.DRIVING_ACTION),
        driverStates: this.timelineRow(incidents, IncidentCategory.DRIVER_STATE),
      },
      metadata: {
        hasRoute: route.points.length > 0,
        hasIncidents: incidents.length > 0,
        incidentsWithoutLocation: incidents.filter((incident) => incident.location === null).length,
        speedUnit: 'km/h',
        coordinateSystem: 'WGS84',
        nearLimitTolerancePercent: DEFAULT_NEAR_LIMIT_TOLERANCE_PERCENT,
      },
    };
  }

  private async findTrip(tripId: Types.ObjectId): Promise<MapTripRow> {
    const trip = await this.tripsRepository.findMapTrip(tripId);
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  private async buildRoute(trip: MapTripRow, { from, to, maxPoints }: { from?: Date; to?: Date; maxPoints: number }): Promise<TripRouteDto> {
    const range = { from, to };
    // Counted first so the points can be thinned out while streaming, without loading them all
    const count = await this.tripRouteRepository.countPoints(trip._id, range);
    const stride = Math.max(1, Math.ceil(count / maxPoints));
    const { points, total } = await sampleRoute(this.classifiedPoints(trip, range), stride);

    return {
      points,
      segments: buildSpeedSegments(points.map((point) => point.speedCategory)),
      totalPoints: total,
      downsampled: points.length < total,
    };
  }

  private async *classifiedPoints(trip: MapTripRow, range: RouteTimeRange): AsyncGenerator<RoutePointDto> {
    for await (const point of this.tripRouteRepository.streamPoints(trip._id, range)) {
      // ?? null: lean() doesn't apply schema defaults, so a field missing from the document comes back undefined
      const speedKmh = point.speedKmh ?? null;
      const { speedLimitKmh, speedLimitSource } = resolveSpeedLimit(point.speedLimitKmh ?? null, trip.speedLimitKmh ?? null);
      yield {
        latitude: point.latitude,
        longitude: point.longitude,
        recordedAt: point.recordedAt.toISOString(),
        offsetSeconds: secondsSince(trip.startedAt, point.recordedAt),
        speedKmh,
        speedLimitKmh,
        speedLimitSource,
        headingDeg: point.headingDeg ?? null,
        speedCategory: classifySpeed(speedKmh, speedLimitKmh),
      };
    }
  }

  private async buildIncidentMarkers(trip: MapTripRow, filter?: TripIncidentFilter, options?: TripIncidentOptions): Promise<IncidentMarkerDto[]> {
    const incidents = await this.incidentsService.findByTrip(trip._id, filter, options);
    return incidents.map(({ _id, type, severity, occurredAt, location, speedKmh, pointsDeducted, clipUrl }) => ({
      id: _id.toString(),
      type,
      category: INCIDENT_CATEGORY[type],
      severity,
      occurredAt: occurredAt.toISOString(),
      offsetSeconds: secondsSince(trip.startedAt, occurredAt),
      location: location ? { latitude: location.latitude, longitude: location.longitude } : null,
      speedKmh: speedKmh ?? null,
      speedLimitKmh: trip.speedLimitKmh ?? null,
      pointsDeducted,
      clipUrl: clipUrl ?? null,
    }));
  }

  private timelineRow(incidents: IncidentMarkerDto[], category: IncidentCategory): TimelineEventDto[] {
    return incidents
      .filter((incident) => incident.category === category)
      .map(({ id, type, severity, occurredAt, offsetSeconds }) => ({
        incidentId: id,
        type,
        severity,
        occurredAt,
        offsetSeconds,
        durationSeconds: null,
      }));
  }
}
