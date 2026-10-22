import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { createdOrganizationResponseSchema, organizationListResponseSchema } from './response/organization.response';
import { AllowedRoles, Public } from '@common';
import { UserRole } from '@common/enums';
import { CreateOrganizationSchema, type CreateOrganizationDto } from './dtos/create-organization.dto';

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

}
