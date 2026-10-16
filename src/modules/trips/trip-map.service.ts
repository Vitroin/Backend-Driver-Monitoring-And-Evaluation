import type { DataResponseDto } from '@common';
import { IncidentCategory } from '@common/enums';
import { INCIDENT_CATEGORY } from '@modules/incidents/incident-category';
import { IncidentsService } from '@modules/incidents/incidents.service';
import type { TripIncidentFilter } from '@modules/incidents/incidents.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { IncidentMarkerDto, RoutePointDto, TimelineEventDto, TripMapDto, TripRouteDto } from './response';
import { canViewTrip, type TripViewer } from './trip-access';
import { buildSpeedSegments, classifySpeed, DEFAULT_NEAR_LIMIT_TOLERANCE_PERCENT, resolveSpeedLimit, sampleRoute } from './trip-route';
import { TripRouteRepository, type RouteTimeRange } from './trip-route.repository';
import type { TripMapQueryDto, TripRouteQueryDto } from './trip_map.dto';
import { TripsRepository, type MapTripRow } from './trips.repository';

const secondsSince = (start: Date, at: Date): number => (at.getTime() - start.getTime()) / 1000;

// The trip page's map: the GPS route coloured by speed, the incident markers, and the timeline under it
@Injectable()
export class TripMapService {
  constructor(
    private readonly tripsRepository: TripsRepository,
    private readonly tripRouteRepository: TripRouteRepository,
    private readonly incidentsService: IncidentsService,
  ) {}

  async getRoute(viewer: TripViewer, tripId: Types.ObjectId, query: TripRouteQueryDto): Promise<DataResponseDto<TripRouteDto>> {
    const trip = await this.findViewableTrip(viewer, tripId);
    return { message: 'Trip route', data: await this.buildRoute(trip, query) };
  }

  async getIncidents(
    viewer: TripViewer,
    tripId: Types.ObjectId,
    filter: TripIncidentFilter,
  ): Promise<DataResponseDto<IncidentMarkerDto[]>> {
    const trip = await this.findViewableTrip(viewer, tripId);
    return { message: 'Trip incidents', data: await this.buildIncidentMarkers(trip, filter) };
  }

  async getMap(viewer: TripViewer, tripId: Types.ObjectId, { maxPoints }: TripMapQueryDto): Promise<DataResponseDto<TripMapDto>> {
    const trip = await this.findViewableTrip(viewer, tripId);
    const [route, incidents] = await Promise.all([this.buildRoute(trip, { maxPoints }), this.buildIncidentMarkers(trip)]);

    const durationSeconds = trip.durationSeconds ?? null;
    return {
      message: 'Trip map data',
      data: {
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
      },
    };
  }

  // A trip the viewer may not see gets the same 404 as a missing one, so trip ids can't be probed
  private async findViewableTrip(viewer: TripViewer, tripId: Types.ObjectId): Promise<MapTripRow> {
    const trip = await this.tripsRepository.findMapTrip(tripId);
    if (!trip || !canViewTrip(viewer, trip)) throw new NotFoundException('Trip not found');
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

  private async buildIncidentMarkers(trip: MapTripRow, filter?: TripIncidentFilter): Promise<IncidentMarkerDto[]> {
    const incidents = await this.incidentsService.findByTrip(trip._id, filter);
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
