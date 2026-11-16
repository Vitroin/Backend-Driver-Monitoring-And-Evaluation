import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AllowedRoles, BaseResponseSchema, CurrentUser } from '@common';
import type { MessageResponseDto } from '@common';
import { UserRole } from '@common/enums';
import { SupervisionService } from './supervision.service';
import { type AssignSupervisionDto, assignSupervisionSchema } from './assign-supervision.dto';

@Controller('supervisions')
export class SupervisionController {
  constructor(private readonly supervisionService: SupervisionService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: "Assign a driver to a supervisor in the logged in owner's organization" })
  @ApiResponse({ status: 201, standardSchema: BaseResponseSchema() })
  @ApiResponse({ status: 404, description: 'Driver or supervisor not found in this organization' })
  @ApiResponse({ status: 409, description: 'Driver is already assigned to this supervisor' })
  @AllowedRoles([UserRole.SCHOOL_ADMINISTRATOR, UserRole.FLEET_MANAGER, UserRole.INSURANCE_MANAGER])
  @Post()
  assign(
    @CurrentUser('organization') organizationId: Types.ObjectId,
    @Body({ schema: assignSupervisionSchema }) { supervisorId, driverId }: AssignSupervisionDto,
  ): Promise<MessageResponseDto> {
    return this.supervisionService.assign(organizationId.toString(), supervisorId, driverId);
  }
}
