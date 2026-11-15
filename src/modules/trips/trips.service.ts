import type { DataResponseDto } from '@common';
import { IncidentType } from '@common/enums';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IncidentsService } from '@modules/incidents/incidents.service';
import { Types } from 'mongoose';
import type { AccelerationPointDto, SpeedPointDto, SteeringPointDto, TripOverallDto, TripTotalsDto } from './response';
import { canViewTrip, type TripViewer } from './helpers/trip-access';
import { riskForScore, roundToOneDecimal } from './helpers/trip-scoring';
import { TripsRepository } from './trips.repository';
import { type TripsFilterDto } from './dtos/trips-filter.dto';

@Injectable()
export class TripsService {
  constructor(
    private readonly tripsRepository: TripsRepository,
    private readonly incidentsService: IncidentsService,
  ) {}

  //---------- used by the Trip Dashboard ----------
  async getTelemetry(
    viewer: TripViewer,
    tripId: Types.ObjectId,
  ): Promise<
    DataResponseDto<{ speeds: SpeedPointDto[]; accelerations: AccelerationPointDto[]; steerings: SteeringPointDto[] }>
  > {
    await this.findViewableTrip(viewer, tripId);

    const { speeds, accelerations, steerings } = await this.tripsRepository.findTelemetry(tripId);
    return {
      message: 'Trip telemetry',
      data: {
        speeds: speeds.map((s) => ({ time: s.time, speed: s.speed })),
        accelerations: accelerations.map((a) => ({ time: a.time, acceleration: a.acceleration })),
        steerings: steerings.map((s) => ({ time: s.time, steeringWheelAngle: s.steeringWheelAngle })),
      },
    };
  }

  //---------- Used By the Trip Report Dashboard's ----------------
  async getTrip(viewer: TripViewer, tripId: Types.ObjectId): Promise<DataResponseDto<TripOverallDto>> {
    await this.findViewableTrip(viewer, tripId);

    const trip = await this.tripsRepository.findByIdWithDriver(tripId);
    if (!trip) throw new NotFoundException('Trip not found');

    const {
      startedAt,
      vehicle,
      driver,
      durationSeconds,
      distanceKm,
      averageSpeedKmh,
      topSpeedKmh,
      eventsCount,
      score,
    } = trip;
    return {
      message: 'Trip statistics',
      data: {
        startedAt: startedAt.toISOString(),
        vehicle,
        driverName: driver?.fullName ?? null,
        durationSeconds,
        distanceKm,
        averageSpeedKmh,
        topSpeedKmh,
        eventsCount,
        score,
        risk: typeof score === 'number' ? riskForScore(score) : null,
      },
    };
  }

  async incidentAnalysis(viewer: TripViewer, tripId: Types.ObjectId) {
    await this.findViewableTrip(viewer, tripId);

    const incidents = await this.incidentsService.findByTrip(tripId);
    const analysis = Object.values(IncidentType).map((incidentType) => {
      const ofType = incidents.filter((incident) => incident.type === incidentType);
      return {
        incidentType,
        count: ofType.length,
        totalDeduction: roundToOneDecimal(ofType.reduce((sum, incident) => sum + incident.pointsDeducted, 0)),
      };
    });

    return { message: 'Incident analysis', data: analysis };
  }

  //---------- -------------- ----------

  // Totals over the driver's completed trips, plus how the last trip compares with the last 5
  async getTotals(driverId: string): Promise<DataResponseDto<TripTotalsDto>> {
    const [totals, [lastTrip], [recentAverage]] = await Promise.all([
      this.tripsRepository.getTotals(driverId),
      this.tripsRepository.findRecentTrip(driverId, 1),
      this.tripsRepository.averageRecentTripScore(driverId, 5),
    ]);

    const lastTripScore = lastTrip?.score ?? null;
    const difference =
      lastTripScore !== null && recentAverage ? roundToOneDecimal(lastTripScore - recentAverage.averageScore) : null;

    return { message: 'Trip totals', data: { ...totals, lastTripScore, difference } };
  }

  async filterTrips(driverId: string, dto: TripsFilterDto) {
    const { trips, total } = await this.tripsRepository.filterTrips(driverId, dto);
    return {
      message: 'Filtered trips',
      data: {
        trips,
        pagination: { page: dto.page, limit: dto.limit, total, totalPages: Math.ceil(total / dto.limit) },
      },
    };
  }

  //--------------------------------------------------------

  // Average of the last 5 scored trips minus the average of the first 5; null until the driver has one
  async changeSinceStart(driverId: string) {
    const [recent] = await this.tripsRepository.averageRecentTripScore(driverId, 5);
    const [first] = await this.tripsRepository.averageLastTripScore(driverId, 5);

    return recent && first ? roundToOneDecimal(recent.averageScore - first.averageScore) : null;
  }

  async progressComponentsData(driverId: string) {
    const [recent] = await this.tripsRepository.averageRecentTripScore(driverId, 5);
    const changeSinceStart = await this.changeSinceStart(driverId);
    const [longTermAverage] = await this.tripsRepository.averageLongTermScore(driverId);
    const [bestTrip] = await this.tripsRepository.bestTripScore(driverId);

    return {
      message: 'Progress components data',
      data: {
        recentAverage: recent?.averageScore ?? null,
        changeSinceStart,
        longTermAverage: longTermAverage?.averageScore ?? null,
        bestTrip: bestTrip?.bestScore ?? null,
      },
    };
  }

  // Used by the reports module
  async averageLongTermScore(driverId: string) {
    return this.tripsRepository.averageLongTermScore(driverId);
  }

  
  async progressGraph(driverId: string) {
    const [graphData] = await this.tripsRepository.progressGraph(driverId);
    return {
      message: 'Progress graph data',
      data: graphData?.trips ?? [],
    };
  }

  // A trip the viewer may not see gets the same 404 as a missing one, so trip ids can't be probed
  private async findViewableTrip(viewer: TripViewer, tripId: Types.ObjectId) {
    const trip = await this.tripsRepository.findMapTrip(tripId);
    if (!trip || !canViewTrip(viewer, trip)) throw new NotFoundException('Trip not found');
    return trip;
  }
}
