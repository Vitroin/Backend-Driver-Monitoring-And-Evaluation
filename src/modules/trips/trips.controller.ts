import type { DataResponseDto } from '@common';
import { AllowedRoles, BaseResponseSchema, CurrentUser } from '@common';
import { UserRole } from '@common/enums';
import type { UserDocument } from '@modules/users/user.model';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import {
  filteredTripsPageSchema,
  tripOverallSchema,
  tripTotalsSchema,
  type TripOverallDto,
  type TripTotalsDto,
} from './response';
import { TripsService } from './trips.service';
import { tripsFilterSchema, type TripsFilterDto } from './dtos/trips-filter.dto';

// Every route here is the logged-in driver's own dashboard data
@AllowedRoles([UserRole.DRIVER])
@ApiBearerAuth()
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @ApiOperation({
    summary: "The logged-in driver's trips matching the filters, newest first and paginated, each with its incidents",
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(filteredTripsPageSchema) })
  @Get('filteredTrips')
  getFilteredTrips(@CurrentUser('id') driverId: string, @Query({ schema: tripsFilterSchema }) dto: TripsFilterDto) {
    return this.tripsService.filterTrips(driverId, dto);
  }

  @ApiOperation({
    summary: "The logged-in driver's totals over completed trips: trip count, distance and driving time",
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripTotalsSchema) })
  @Get('/totals')
  getMyTotals(@CurrentUser('id') driverId: string): Promise<DataResponseDto<TripTotalsDto>> {
    return this.tripsService.getTotals(driverId);
  }

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's overall stats: duration, distance, speeds, event count, score and risk" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripOverallSchema) })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get('tripStatistics/:tripId')
  getTrip(
    @CurrentUser() user: UserDocument,
    @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId,
  ): Promise<DataResponseDto<TripOverallDto>> {
    return this.tripsService.getTrip(user, tripId);
  }

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's speed, acceleration and steering wheel angle over time" })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get(':tripId/telemetry')
  getTelemetry(@CurrentUser() user: UserDocument, @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId) {
    return this.tripsService.getTelemetry(user, tripId);
  }

  //---------- Used By the Trip Report Dashboard's ----------------

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's incident count and points deducted per incident type" })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get('incidentAnalysis/:tripId')
  getIncidentAnalysis(@CurrentUser() user: UserDocument, @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId) {
    return this.tripsService.incidentAnalysis(user, tripId);
  }

  //---------- Used By the My Progress Dashboard's ----------------
  @ApiOperation({
    summary: "The logged-in driver's recent average, change since start, long-term average and best trip",
  })
  @Get('progressDetails')
  progressComponentData(@CurrentUser('id') driverId: string) {
    return this.tripsService.progressComponentsData(driverId);
  }

  @ApiOperation({ summary: "The logged-in driver's score per completed trip, oldest first" })
  @Get('progressGraph')
  progressGraph(@CurrentUser('id') driverId: string) {
    return this.tripsService.progressGraph(driverId);
  }
}
