import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllowedRoles, BaseResponseSchema, CurrentUser, DataResponseDto } from '@common';
import { UserRole } from '@common/enums';

import { IncidentsService } from './incidents.service';
import { SignificantEventDto, significantEventSchema } from './response/significant-event.response';

@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @AllowedRoles([UserRole.DRIVER])
  @ApiOperation({ summary: "The logged-in driver's 5 incidents that cost the most points in the last 60 days" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(significantEventSchema.array()) })
  @Get('me/significant')
  getMyMostSignificant(@CurrentUser('id') driverId: string): Promise<DataResponseDto<SignificantEventDto[]>> {
    return this.incidentsService.getMostSignificant(driverId);
  }
}