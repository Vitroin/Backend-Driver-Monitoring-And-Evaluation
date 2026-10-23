import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { OrganizationsService } from './organizations.service';
import { createdOrganizationResponseSchema, employeeInvitedResponseSchema, organizationListResponseSchema } from './response/organization.response';
import { AllowedRoles, Public } from '@common';
import { UserRole } from '@common/enums';
import { CreateOrganizationSchema, type CreateOrganizationDto } from './dtos/create-organization.dto';
import { InviteEmployeeSchema, type InviteEmployeeDto } from './dtos/invite-employee.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @ApiOperation({
    summary: 'List all organizations',
    description: 'Each organization with its name, type, owner id and creation date, sorted by name.',
  })
  @ApiResponse({ status: 200, standardSchema: organizationListResponseSchema })
  @Public()
  @Get('/getAllOrganizations')
  async getAllOrganizations() {
    return await this.organizationsService.findAllOrganizations();
  }


  @ApiBearerAuth()
  @AllowedRoles([UserRole.SUPER_ADMIN])
  @ApiOperation({
    summary: 'Create an organization and invite its owner',
    description:
      'Creates the organization and a new user as its owner, with a role that depends on the organization type. The owner is emailed a link to set their password.',
  })
  @ApiResponse({ status: 201, standardSchema: createdOrganizationResponseSchema })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Not a super admin (hidden as not found)' })
  @ApiResponse({ status: 409, description: 'Organization already exists' })
  @Post('/createOrganization')
  async createOrganization(@Body({ schema: CreateOrganizationSchema }) dto: CreateOrganizationDto) {
    // Implement the logic to create an organization here
    return await this.organizationsService.createOrganization(dto);
  }


  
  // @ApiBearerAuth()
  @Public()
  @ApiOperation({
    summary: 'Invite an employee into an organization',
    description:
      'Creates a new user in the organization, with a role that depends on the organization type: driver instructor for a driving school, fleet analyst for a fleet company, insurance analyst for an insurance company. The employee is emailed a link to set their password.',
  })
  @ApiParam({ name: 'organizationId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @ApiResponse({ status: 201, standardSchema: employeeInvitedResponseSchema })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @Post('/:organizationId/inviteEmployee')
  async inviteEmployee(
    @Param('organizationId', ParseObjectIdPipe) organizationId: Types.ObjectId,
    @Body({ schema: InviteEmployeeSchema }) dto: InviteEmployeeDto,
  ) {
    return await this.organizationsService.inviteEmployee(organizationId.toString(), dto);
  }
}
