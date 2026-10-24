import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { BaseResponseSchema, CurrentUser } from '@common';
import type { DataResponseDto } from '@common';
import { incidentTypeSummarySchema, type IncidentTypeSummaryDto } from '@modules/incidents/response/trip-incidents.response';
import { driverIncidentSchema, type DriverIncidentDto } from '@modules/incidents/response/significant-event.response';
import { scorePointSchema, type ScorePointDto } from '@modules/trips/response/score-overview.response';
import { driverIdParamSchema, type DriverIdParam } from '@modules/users/list-users.dto';
import { DriversService } from './drivers.service';
import { driverStatsSchema, type DriverStatsDto } from './driver-stats.response';
import {
  driverIncidentsQuerySchema,
  driverIncidentsSummaryQuerySchema,
  type DriverIncidentsQueryDto,
  type DriverIncidentsSummaryQueryDto,
} from './driver-incidents.dto';

const driverIdParam = ApiParam({ name: 'driverId', type: String, description: 'A driver id, or `me`', example: 'me' });

// `me` is the logged-in user
const toDriverId = (driverId: string, userId: Types.ObjectId): Types.ObjectId =>
  driverId === 'me' ? userId : new Types.ObjectId(driverId);

// A driver's data across their trips. Their coaching is under GET /drivers/:driverId/coaching.
@ApiBearerAuth()
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @driverIdParam
  @ApiOperation({ summary: "The driver's totals and scores: last trip, recent and long-term averages, best trip, risk" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(driverStatsSchema) })
  @Get(':driverId/stats')
  async getStats(
    @CurrentUser('_id') userId: Types.ObjectId,
    @Param({ schema: driverIdParamSchema }) { driverId }: DriverIdParam,
  ): Promise<DataResponseDto<DriverStatsDto>> {
    return { message: 'Driver stats', data: await this.driversService.getStats(toDriverId(driverId, userId)) };
  }

  @driverIdParam
  @ApiOperation({ summary: "The driver's score per scored trip, oldest first (the score-over-time chart)" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(scorePointSchema.array()) })
  @Get(':driverId/score-history')
  async getScoreHistory(
    @CurrentUser('_id') userId: Types.ObjectId,
    @Param({ schema: driverIdParamSchema }) { driverId }: DriverIdParam,
  ): Promise<DataResponseDto<ScorePointDto[]>> {
    return { message: 'Score history', data: await this.driversService.scoreHistory(toDriverId(driverId, userId)) };
  }

  @driverIdParam
  @ApiOperation({ summary: "Count and points lost per incident type across the driver's trips; every type is listed" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(incidentTypeSummarySchema.array()) })
  @Get(':driverId/incidents/summary')
  async getIncidentSummary(
    @CurrentUser('_id') userId: Types.ObjectId,
    @Param({ schema: driverIdParamSchema }) { driverId }: DriverIdParam,
    @Query({ schema: driverIncidentsSummaryQuerySchema }) { days }: DriverIncidentsSummaryQueryDto,
  ): Promise<DataResponseDto<IncidentTypeSummaryDto[]>> {
    return { message: 'Incidents per type', data: await this.driversService.incidentSummary(toDriverId(driverId, userId), days) };
  }

  @driverIdParam
  @ApiOperation({
    summary: "The driver's incidents across their trips",
    description: 'Newest first by default. `?days=60&sort=-pointsDeducted&limit=5` gives the dashboard\'s "most significant events".',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(driverIncidentSchema.array()) })
  @Get(':driverId/incidents')
  async getIncidents(
    @CurrentUser('_id') userId: Types.ObjectId,
    @Param({ schema: driverIdParamSchema }) { driverId }: DriverIdParam,
    @Query({ schema: driverIncidentsQuerySchema }) query: DriverIncidentsQueryDto,
  ): Promise<DataResponseDto<DriverIncidentDto[]>> {
    return { message: 'Driver incidents', data: await this.driversService.incidents(toDriverId(driverId, userId), query) };
  }
}
