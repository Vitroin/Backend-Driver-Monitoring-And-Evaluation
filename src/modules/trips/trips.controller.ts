import { tripsFilterSchema, type TripsFilterDto } from './trips_filter.dto';
import { AllowedRoles, BaseResponseSchema, CurrentUser, Public } from '@common';
import type { DataResponseDto } from '@common';
import { UserRole } from '@common/enums';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  lastTripScoreSchema,
  recentTripSchema,
  tripTotalsSchema,
  type LastTripScoreDto,
  type RecentTripDto,
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

  @Get('test/:driverId')
  test(@Param('driverId', ParseObjectIdPipe) driverId: Types.ObjectId, @Query({ schema: tripsFilterSchema }) dto: TripsFilterDto) {
    console.log('driverId:', driverId)
    return this.tripsService.test(driverId , dto);
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
}
