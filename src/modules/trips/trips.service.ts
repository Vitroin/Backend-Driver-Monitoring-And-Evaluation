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

  async getTripDetectedEvents(tripId: Types.ObjectId): Promise<DataResponseDto<DetectedEventDto[]>> {
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

  //---------- Used By the Trip Report Dashboard's ----------------

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

  //Trip Report: get trip statistics: duration, distance, average speed, top speed, events count
  async getTripStatistics(tripId: Types.ObjectId) {
    const trip = await this.tripsRepository.findById(tripId.toString());
    if (!trip) throw new NotFoundException('Trip not found');
    return {
      message: 'Trip statistics',
      data: {
        durationSeconds: trip.durationSeconds,
        distanceKm: trip.distanceKm,
        averageSpeedKmh: trip.averageSpeedKmh,
        topSpeedKmh: trip.topSpeedKmh,
        eventsCount: trip.eventsCount,
      },
    };
  }

  async incidentAnalysis(tripId: Types.ObjectId) {
    const trip = await this.tripsRepository.findById(tripId.toString());
    if (!trip) throw new NotFoundException('Trip not found');

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

  // ---------- used by the Main Dashboard ----------
  // Long-term score ring + "Score over time" chart

  // Returns 
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

  async getRecentTrips(driverId: string): Promise<DataResponseDto<RecentTripDto[]>> {
    const trips = await this.tripsRepository.findRecentTrip(driverId, RECENT_TRIPS_LIST_SIZE);
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

  filterTrips(driverId: string, dto: TripsFilterDto) {
    return this.tripsRepository.filterTrips(driverId, dto);
  }

  //--------------------------------------------------------
  // ---------- used by the My Progress Dashboard ----------
  async averageRecentTripScore(driverId: string) {
    return this.tripsRepository.averageRecentTripScore(driverId, 5);
  }

  // Average of the last 5 scored trips minus the first scored trip; null until the driver has one
  async changeSinceStart(driverId: string) {
    const [recent] = await this.tripsRepository.averageRecentTripScore(driverId, 5);
    const [first] = await this.tripsRepository.averageLastTripScore(driverId, 5);

    const change = recent && first ? roundToOneDecimal(recent.averageScore - first.averageScore) : null;
    return { message: 'Change since start', data: { change } };
  }

  async progressComponentsData(driverId: string) {
    const [recent] = await this.tripsRepository.averageRecentTripScore(driverId, 5);
    const changeSinceStart = await this.changeSinceStart(driverId);
    const longTermAverage = await this.tripsRepository.averageLongTermScore(driverId);
    const bestTrip = await this.tripsRepository.bestTripScore(driverId);

    return {
      message: 'Progress components data',
      data: {
        recentAverage: recent?.averageScore ?? null,
        changeSinceStart: changeSinceStart,
        longTermAverage: longTermAverage ?? null,
        bestTrip: bestTrip ?? null,
      },
    };
  }

  async averageLongTermScore(driverId: string) {
    return this.tripsRepository.averageLongTermScore(driverId);
  }

  async progressGraph(driverId: string) {
    const graphData = await this.tripsRepository.progressGraph(driverId);
    return {
      message: 'Progress graph data',
      data: graphData,
    };
  }
}
