import { Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AllowedRoles, CurrentUser } from '@common';
import type { MessageResponseDto } from '@common';
import { UserRole } from '@common/enums';
import { InstructorsService } from './instructors.service';
import { studentAssignedResponseSchema } from './response/instructor.response';

@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @ApiBearerAuth()
  @AllowedRoles([UserRole.SCHOOL_ADMINISTRATOR])
  @ApiOperation({
    summary: "Add a driver to an instructor's students",
    description:
      "For a driving school's administrator: the instructor and the driver must both be in the administrator's school. Assigning a driver who is already the instructor's student changes nothing.",
  })
  @ApiParam({ name: 'instructorId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @ApiParam({ name: 'driverId', type: String, example: '665f1c2e8b3e4a1d2c9f0a13' })
  @ApiResponse({ status: 201, standardSchema: studentAssignedResponseSchema })
  @ApiResponse({ status: 400, description: 'Invalid instructor or driver id' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({
    status: 404,
    description: "Not a school administrator (hidden as not found), or the instructor or driver isn't in their school",
  })
  @Post(':instructorId/students/:driverId')
  async assignStudent(
    @CurrentUser('organization') organizationId: Types.ObjectId | null | undefined,
    @Param('instructorId', ParseObjectIdPipe) instructorId: Types.ObjectId,
    @Param('driverId', ParseObjectIdPipe) driverId: Types.ObjectId,
  ): Promise<MessageResponseDto> {
    // Super admins pass every role check but belong to no school, so there's no school to assign in
    if (!organizationId) throw new NotFoundException('Resource not found');
    await this.instructorsService.assignStudent(organizationId.toString(), instructorId.toString(), driverId.toString());
    return { message: 'Driver assigned to instructor successfully' };
  }
}
