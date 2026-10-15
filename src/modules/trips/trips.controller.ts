import { AllowedRoles, BaseResponseSchema, CurrentUser } from '@common';
import type { DataResponseDto } from '@common';
import { UserRole } from '@common/enums';
import { Controller, Get } from '@nestjs/common';
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

// Every route here is the logged-in driver's own dashboard data
@AllowedRoles([UserRole.DRIVER])
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

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
