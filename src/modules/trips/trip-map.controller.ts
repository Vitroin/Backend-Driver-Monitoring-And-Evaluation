import { BaseResponseSchema } from '@common';
import type { DataResponseDto } from '@common';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import {
  incidentMarkerSchema,
  tripMapSchema,
  tripRouteSchema,
  type IncidentMarkerDto,
  type TripMapDto,
  type TripRouteDto,
} from './response';
import { TripMapService } from './trip-map.service';
import {
  tripIncidentsQuerySchema,
  tripMapQuerySchema,
  tripRouteQuerySchema,
  type TripIncidentsQueryDto,
  type TripMapQueryDto,
  type TripRouteQueryDto,
} from './trip_map.dto';

// The trip page's map. Login required.
@ApiBearerAuth()
@Controller('trips')
export class TripMapController {
  constructor(private readonly tripMapService: TripMapService) {}

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: 'Everything the trip map needs in one call: trip summary, route, incident markers and timeline' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripMapSchema) })
  @ApiResponse({ status: 400, description: 'Invalid trip id or query' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get(':tripId/map')
  async getMap(
    @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId,
    @Query({ schema: tripMapQuerySchema }) query: TripMapQueryDto,
  ): Promise<DataResponseDto<TripMapDto>> {
    return { message: 'Trip map data', data: await this.tripMapService.getMap(tripId, query) };
  }

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's GPS route in chronological order, with each point's speed category and the coloured segments" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(tripRouteSchema) })
  @ApiResponse({ status: 400, description: 'Invalid trip id or query' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get(':tripId/route')
  async getRoute(
    @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId,
    @Query({ schema: tripRouteQuerySchema }) query: TripRouteQueryDto,
  ): Promise<DataResponseDto<TripRouteDto>> {
    return { message: 'Trip route', data: await this.tripMapService.getRoute(tripId, query) };
  }

  @ApiParam({ name: 'tripId', type: String, example: '6ad24e609609bf3649c97cdf' })
  @ApiOperation({ summary: "A trip's incidents with their map location when one was recorded", description: 'Chronological by default; `?sort=-pointsDeducted&limit=5` gives the costliest five.' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(incidentMarkerSchema.array()) })
  @ApiResponse({ status: 400, description: 'Invalid trip id or query' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get(':tripId/incidents')
  async getIncidents(
    @Param('tripId', ParseObjectIdPipe) tripId: Types.ObjectId,
    @Query({ schema: tripIncidentsQuerySchema }) query: TripIncidentsQueryDto,
  ): Promise<DataResponseDto<IncidentMarkerDto[]>> {
    return { message: 'Trip incidents', data: await this.tripMapService.getIncidents(tripId, query) };
  }
}
