import type { DataResponseDto } from '@common';
import { AllowedRoles, BaseResponseSchema, CurrentUser } from '@common';
import { UserRole } from '@common/enums';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import {
  accelerationPointSchema,
  detectedEventSchema,
  recentTripSchema,
  speedPointSchema,
  steeringPointSchema,
  tripListItemSchema,
  tripOverallSchema,
  tripTotalsSchema,
  type AccelerationPointDto,
  type DetectedEventDto,
  type RecentTripDto,
  type SpeedPointDto,
  type SteeringPointDto,
  type TripOverallDto,
  type TripTotalsDto,
} from './response';
import { TripsService } from './trips.service';
import { tripsFilterSchema, type TripsFilterDto } from './trips_filter.dto';

// Every route here is the logged-in driver's own dashboard data
@AllowedRoles([UserRole.DRIVER])
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @ApiParam({ name: 'driverId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @ApiOperation({
    summary: "A driver's trips matching the filters, newest first and paginated, each with its incidents",
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripListItemSchema.array()) })
  @Get('filteredTrips/:driverId')
  getFilteredTrips(
    @Param('driverId', ParseObjectIdPipe) driverId: string,
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
  getDetectedEvents(
    @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId,
  ): Promise<DataResponseDto<DetectedEventDto[]>> {
    return this.tripsService.getTripDetectedEvents(tripId);
  }

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's speed over time, for the speed motion graph" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(speedPointSchema.array()) })
  @ApiResponse({ status: 400, description: 'Invalid trip id' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get('speedMotionGraph/:tripId')
  getSpeedMotionGraph(
    @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId,
  ): Promise<DataResponseDto<SpeedPointDto[]>> {
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
  @ApiBearerAuth()
  @Get('me/totals')
  getMyTotals(@CurrentUser('id') driverId: string): Promise<DataResponseDto<TripTotalsDto>> {
    return this.tripsService.getTotals(driverId);
  }

  @ApiOperation({ summary: "The logged-in driver's 6 latest trips, planned ones included" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(recentTripSchema.array()) })
  @Get('me/recent')
  getMyRecentTrips(@CurrentUser('id') driverId: string): Promise<DataResponseDto<RecentTripDto[]>> {
    return this.tripsService.getRecentTrips(driverId);
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

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @Get('tripStatistics/:tripId')
  getTripStatistics(@Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId) {
    return this.tripsService.getTripStatistics(tripId);
  }

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @Get('incidentAnalysis/:tripId')
  getIncidentAnalysis(@Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId) {
    return this.tripsService.incidentAnalysis(tripId);
  }

  //---------- Used By the My Progress Dashboard's ----------------
  @ApiParam({ name: 'driverId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @Get('progressDetails/:driverId')
  progressComponentData(@Param('driverId', ParseObjectIdPipe) driverId: string) {
    return this.tripsService.progressComponentsData(driverId);
  }

  @ApiParam({ name: 'driverId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @Get('progressGraph/:driverId')
  progressGraph(@Param('driverId', ParseObjectIdPipe) driverId: string) {
    return this.tripsService.progressGraph(driverId);
  }
}
