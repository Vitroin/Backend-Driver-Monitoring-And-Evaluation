import { Controller, Get } from '@nestjs/common';
import { TripsService } from './trips.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllowedRoles, BaseResponseSchema, CurrentUser } from '@common';
import { UserRole } from '@common/enums';
import { DataResponseDto } from '@modules/auth/response';
import { TripTotalsDto, tripTotalsSchema } from './response';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @AllowedRoles([UserRole.DRIVER])
  @ApiOperation({
    summary: "The logged-in driver's totals over completed trips: trip count, distance and driving time",
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripTotalsSchema) })
  @Get('me/totals')
  getMyTotals(@CurrentUser('id') driverId: string): Promise<DataResponseDto<TripTotalsDto>> {
    return this.tripsService.getTotals(driverId);
  }
}
