import { AllowedRoles, BaseResponseSchema, CurrentUser, DataResponseDto } from '@common';
import { UserRole } from '@common/enums';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { type  MyIncidentsQueryDto, myIncidentsQuerySchema } from './dtos/my-incidents.query';
import { type IncidentsOverviewDto, incidentsOverviewSchema } from './response/incidents-overall.response';

@ApiBearerAuth()
@AllowedRoles([UserRole.DRIVER])
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  /*
   * One endpoint for every incident widget:
   *   Main Dashboard (most significant):  ?sinceDays=60&limit=5
   *   Trip Report (top incidents):        ?tripId=<id>&limit=5
   *   Car widget + major events:          ?sinceDays=21&severity=medium,high&limit=5
   */
  @Get('overview')
  @ApiOperation({ summary: "The driver's incidents (most points first) plus counts per type for the same filter" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(incidentsOverviewSchema) })
  @ApiResponse({ status: 400, description: 'Invalid query (bad tripId, severity, limit…)' })
  getMyIncidents(
    @CurrentUser('id') driverId: string,
    @Query({ schema: myIncidentsQuerySchema }) query: MyIncidentsQueryDto,
  ): Promise<DataResponseDto<IncidentsOverviewDto>> {
    return this.incidentsService.getMyIncidents(driverId, query);
  }


}