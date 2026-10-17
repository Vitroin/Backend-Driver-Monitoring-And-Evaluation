import { AllowedRoles, BaseResponseSchema, CurrentUser, DataResponseDto } from '@common';
import { UserRole } from '@common/enums';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { IncidentsService } from './incidents.service';
import { SignificantEventDto, significantEventSchema } from './response/significant-event.response';
import { tripIncidentsSchema } from './response/trip-incidents.response';

@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}


  @AllowedRoles([UserRole.DRIVER])
  @ApiOperation({ summary: "The logged-in driver's 5 incidents that cost the most points in the last 60 days" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(significantEventSchema.array()) })
  @Get('/significant')
  /*Main Dashboard: This function is used to get incidents that  cost the most points within the range of 60 days, this endpoint is used in the MainPage*/
  getMyMostSignificant(@CurrentUser('id') driverId: string): Promise<DataResponseDto<SignificantEventDto[]>> {
    return this.incidentsService.getIncidents(driverId);
  }

  @AllowedRoles([UserRole.DRIVER])
  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiQuery({ name: 'limit', type: Number, required: false, description: 'How many incidents to return', example: 5 })
  @ApiOperation({ summary: "A trip's incidents, most points deducted first" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripIncidentsSchema) })
  @ApiResponse({ status: 400, description: 'Invalid trip id' })
  @Get('/trip/:tripId')
  /*Trip Report Dashboard This function is used to get incidents that happened during a particular trip, and sort thing with using the most deducted*/
  getMyTripIncidents(@Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId, @Query() limit: number) {
    return this.incidentsService.getTopIncidentsForTrip(tripId, limit);
  }


  @AllowedRoles([UserRole.DRIVER])
  @ApiParam({ name: 'driverId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @ApiOperation({ summary: "A trip's incidents count, grouped by type" })
  @ApiResponse({ status: 400, description: 'Invalid driver id' })
  @Get('/tripIncidentsCount/:driverId')
  /*Progress Dashboard This function is used to get incidents that happened during a particular trip, and group them by type*/
  getMyTripIncidentsCount(@Param('driverId', ParseObjectIdPipe) driverId: Types.ObjectId) {
    return this.incidentsService.getAllIncidentsForTrip(driverId);
  }

  @AllowedRoles([UserRole.DRIVER])
  @ApiParam({ name: 'driverId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @ApiOperation({ summary: "A trip's incidents count, grouped by type" })
  @ApiResponse({ status: 400, description: 'Invalid driver id' })
  @Get('/eventMix/:driverId')
  /*Progress Dashboard This function is used to get incidents that happened during a particular trip, and group them by type*/
  getMyEventMix(@Param('driverId', ParseObjectIdPipe) driverId: Types.ObjectId) {
    return this.incidentsService.getEventMix(driverId);
  }
}
