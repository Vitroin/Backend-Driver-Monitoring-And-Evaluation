import { tripsFilterSchema, type TripsFilterDto } from './trips_filter.dto';
import { AllowedRoles, BaseResponseSchema, CurrentUser, Public } from '@common';
import type { DataResponseDto } from '@common';
import { UserRole } from '@common/enums';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  accelerationPointSchema,
  detectedEventSchema,
  filteredTripSchema,
  lastTripScoreSchema,
  tripOverallSchema,
  recentTripSchema,
  speedPointSchema,
  steeringPointSchema,
  tripTotalsSchema,
  type AccelerationPointDto,
  type DetectedEventDto,
  type LastTripScoreDto,
  type RecentTripDto,
  type SpeedPointDto,
  type SteeringPointDto,
  type TripOverallDto,
  type TripTotalsDto,
} from './response';
import { TripsService } from './trips.service';
import { ScoreOverviewDto, scoreOverviewSchema } from './response/score-overview.response';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';

// Every route here is the logged-in driver's own dashboard data
// @AllowedRoles([UserRole.DRIVER])
@Public()
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  
  @ApiParam({ name: 'driverId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @ApiOperation({
    summary: "A driver's trips matching the filters, newest first and paginated, each with its incidents",
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(filteredTripSchema.array()) })
  @Get('filteredTrips/:driverId')
  getFilteredTrips(
    @Param('driverId', ParseObjectIdPipe) driverId: Types.ObjectId,
    @Query({ schema: tripsFilterSchema }) dto: TripsFilterDto,
  ) {
    return this.tripsService.filterTrips(driverId, dto);
  }



  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's overall stats: duration, distance, speeds, event count, score and risk" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripOverallSchema) })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get('tripOverall/:tripId')
  getTripOverall(@Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId): Promise<DataResponseDto<TripOverallDto>> {
    return this.tripsService.getTripOverall(tripId);
  }


  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's detected events: type, severity, time and points deducted" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(detectedEventSchema.array()) })
  @ApiResponse({ status: 400, description: 'Invalid trip id' })
  @Get('detectedEvents/:tripId')
  getDetectedEvents(@Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId): Promise<DataResponseDto<DetectedEventDto[]>> {
    return this.tripsService.getDetectedEvents(tripId);
  }


  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's speed over time, for the speed motion graph" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(speedPointSchema.array()) })
  @ApiResponse({ status: 400, description: 'Invalid trip id' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get('speedMotionGraph/:tripId')
  getSpeedMotionGraph(@Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId): Promise<DataResponseDto<SpeedPointDto[]>> {
    return this.tripsService.getSpeedMotionGraph(tripId);
  }


  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's acceleration over time, for the acceleration motion graph" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(accelerationPointSchema.array()) })
  @ApiResponse({ status: 400, description: 'Invalid trip id' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get('accelerationMotionGraph/:tripId')
  getAccelerationMotionGraph(
    @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId,
  ): Promise<DataResponseDto<AccelerationPointDto[]>> {
    return this.tripsService.getAccelerationMotionGraph(tripId);
  }


  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's steering wheel angle over time, for the steering motion graph" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(steeringPointSchema.array()) })
  @ApiResponse({ status: 400, description: 'Invalid trip id' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get('steeringMotionGraph/:tripId')
  getSteeringMotionGraph(
    @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId,
  ): Promise<DataResponseDto<SteeringPointDto[]>> {
    return this.tripsService.getSteeringMotionGraph(tripId);
  }
  
  @ApiOperation({
    summary: "The logged-in driver's totals over completed trips: trip count, distance and driving time",
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripTotalsSchema) })
  @Get('me/totals')
  getMyTotals(@CurrentUser('id') driverId: string): Promise<DataResponseDto<TripTotalsDto>> {
    return this.tripsService.getTotals(driverId);
  }



  @ApiOperation({ summary: "The logged-in driver's last trip score compared with their recent average" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(lastTripScoreSchema.nullable()) })
  @Get('me/last-score')
  getMyLastTripScore(@CurrentUser('id') driverId: string): Promise<DataResponseDto<LastTripScoreDto | null>> {
    return this.tripsService.getLastTripScore(driverId);
  }



  @ApiOperation({ summary: "The logged-in driver's 6 latest trips, planned ones included" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(recentTripSchema.array()) })
  @Get('me/recent')
  getMyRecentTrips(@CurrentUser('id') driverId: string): Promise<DataResponseDto<RecentTripDto[]>> {
    return this.tripsService.getRecentTrips(driverId);
  }



  @ApiOperation({ summary: "The logged-in driver's long-term score, risk level and score history" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(scoreOverviewSchema) })
  @Get('me/score-overview')
  getMyScoreOverview(@CurrentUser('id') driverId: string): Promise<DataResponseDto<ScoreOverviewDto>> {
    return this.tripsService.getScoreOverview(driverId);
  }


  //---------- Used By the Trip Report Dashboard's ----------------
  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @Get('tripReportHeader/:tripId')
  getTripDashboardHeader(@Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId) {
    return this.tripsService.getTripDashboardHeader(tripId);
  }
  
  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @Get('incidentsCount/:tripId')
  getIncidentsCount(@Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId) {
    return this.tripsService.getIncidentsCount(tripId);
  }

  
}
