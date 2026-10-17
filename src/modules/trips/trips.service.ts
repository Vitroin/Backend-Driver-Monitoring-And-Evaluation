import type { DataResponseDto } from '@common';
import { IncidentType } from '@common/enums';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IncidentsService } from '@modules/incidents/incidents.service';
import { Types } from 'mongoose';
import type {
  AccelerationPointDto,
  DetectedEventDto,
  LastTripScoreDto,
  RecentTripDto,
  SpeedPointDto,
  SteeringPointDto,
  TripOverallDto,
  TripTotalsDto,
} from './response';
import { average, longTermScore, riskForScore, roundToOneDecimal } from './trip-scoring';
import { TripDocument } from './trips.model';
import { TripsRepository } from './trips.repository';
import { ScoreOverviewDto } from './response/score-overview.response';
import { TripsFilterDto } from './trips_filter.dto';

// "Last trip score" compares the last trip with the average of the 5 before it
const RECENT_TRIPS = 5;
// How many trips the dashboard's "Recent trips" card shows
const RECENT_TRIPS_LIST_SIZE = 6;

@Injectable()
export class TripsService {
  constructor(
    private readonly tripsRepository: TripsRepository,
    private readonly incidentsService: IncidentsService,
  ) {}

  // ---------- used by the Main Dashboard ----------
  async getLastTripScore(driverId: string): Promise<DataResponseDto<LastTripScoreDto | null>> {
    const [last, ...previous] = await this.tripsRepository.findScoredTrips(driverId, { limit: RECENT_TRIPS + 1 });
    if (!last) return { message: 'No completed trips yet', data: null };

    const previousAverage = previous.length > 0 ? average(previous.map((trip) => trip.score)) : null;
    return {
      message: 'Last trip score',
      data: {
        score: last.score,
        previousAverage: previousAverage === null ? null : roundToOneDecimal(previousAverage),
        change: previousAverage === null ? null : roundToOneDecimal(last.score - previousAverage),
      },
    };
  }

  //---------- used by the Trip Dashboard ----------
  // The trip page's overall stats card
  async getTripOverall(tripId: Types.ObjectId): Promise<DataResponseDto<TripOverallDto>> {
    const trip = await this.tripsRepository.findById(tripId.toString());
    if (!trip) throw new NotFoundException('Trip not found');

    const { durationSeconds, distanceKm, averageSpeedKmh, topSpeedKmh, eventsCount, score, risk } = trip;
    return {
      message: 'Trip overall data',
      data: {
        durationMs: durationSeconds === null ? null : durationSeconds * 1000,
        distanceKm,
        averageSpeedKmh,
        topSpeedKmh,
        eventsCount,
        score,
        risk,
      },
    };
  }

  async getDetectedEvents(tripId: Types.ObjectId): Promise<DataResponseDto<DetectedEventDto[]>> {
    const incidents = await this.incidentsService.findByTrip(tripId);
    return {
      message: 'Detected events',
      data: incidents.map(({ type, severity, occurredAt, pointsDeducted }) => ({
        type,
        severity,
        occurredAt: occurredAt.toISOString(),
        pointsDeducted,
      })),
    };
  }

  async getSpeedMotionGraph(tripId: Types.ObjectId): Promise<DataResponseDto<SpeedPointDto[]>> {
    const { speeds } = await this.tripsRepository.findSpeedMotionGraph(tripId);
    return {
      message: 'Trip speed motion graph',
      data: speeds.map((s) => ({ time: s.time, speed: s.speed })),
    };
  }

  async getAccelerationMotionGraph(tripId: Types.ObjectId): Promise<DataResponseDto<AccelerationPointDto[]>> {
    const { accelerations } = await this.tripsRepository.findAccelerationMotionGraph(tripId);
    return {
      message: 'Trip acceleration motion graph',
      data: accelerations.map((a) => ({ time: a.time, acceleration: a.acceleration })),
    };
  }

  async getSteeringMotionGraph(tripId: Types.ObjectId): Promise<DataResponseDto<SteeringPointDto[]>> {
    const { steerings } = await this.tripsRepository.findSteeringMotionGraph(tripId);
    return {
      message: 'Trip steering motion graph',
      data: steerings.map((s) => ({ time: s.time, steeringWheelAngle: s.steeringWheelAngle })),
    };
  }

  //---------- Used By the Trip Dashboard's ----------------

  async getTripDashboardHeader(tripId: Types.ObjectId) {
    const trip = await this.tripsRepository.findDashboardHeader(tripId);
    if (!trip) throw new NotFoundException('Trip not found');

    return {
      message: 'Trip dashboard header',
      data: {
        startedAt: trip.startedAt.toISOString(),
        durationSeconds: trip.durationSeconds,
        vehicle: trip.vehicle,
        driverName: trip.driver?.fullName ?? null,
      },
    };
  }

  // How many times each incident type happened in the trip; types that didn't happen are 0
  async getIncidentsCount(tripId: Types.ObjectId) {
    const incidents = await this.incidentsService.findByTrip(tripId);
    const zeroCounts = Object.fromEntries(Object.values(IncidentType).map((type) => [type, 0])) as Record<
      IncidentType,
      number
    >;
    const counts = incidents.reduce((acc, incident) => {
      acc[incident.type]++;
      return acc;
    }, zeroCounts);

    return { message: 'Trip incidents count', data: counts };
  }

  //---------- -------------- ----------

  // ---------- used by the Main Dashboard ----------
  // Long-term score ring + "Score over time" chart
  async getScoreOverview(driverId: string): Promise<DataResponseDto<ScoreOverviewDto>> {
    const trips = (await this.tripsRepository.findScoredTrips(driverId)).reverse(); // oldest first, like the chart
    const longTerm = longTermScore(trips);
    return {
      message: 'Score overview',
      data: {
        longTermScore: longTerm,
        riskLevel: longTerm === null ? null : riskForScore(longTerm),
        // One point per completed trip; the chart shows the last 14
        history: trips.map((trip) => ({
          tripId: trip._id.toString(),
          code: trip.code,
          score: trip.score,
          startedAt: trip.startedAt.toISOString(),
        })),
      },
    };
  }

  async getTotals(driverId: string): Promise<DataResponseDto<TripTotalsDto>> {
    const totals = await this.tripsRepository.getTotals(driverId);
    // Adding up decimals can give 104.89999999999999, so round the distance
    return { message: 'Trip totals', data: { ...totals, distanceKm: roundToOneDecimal(totals.distanceKm) } };
  }

  async getRecentTrips(driverId: string): Promise<DataResponseDto<RecentTripDto[]>> {
    const trips = await this.tripsRepository.findRecentTrips(driverId, RECENT_TRIPS_LIST_SIZE);
    return {
      message: 'Recent trips',
      data: trips.map(({ code, vehicle, status, startedAt, distanceKm, score, risk }) => ({
        code,
        vehicle,
        status,
        startedAt: startedAt.toISOString(),
        distanceKm,
        score,
        risk,
      })),
    };
  }

  filterTrips(driverId: Types.ObjectId, dto: TripsFilterDto) {
    return this.tripsRepository.filterTrips(driverId, dto);
  }

  // ---------- used by other modules ----------

  findById(id: string): Promise<TripDocument | null> {
    return this.tripsRepository.findById(id);
  }

}
