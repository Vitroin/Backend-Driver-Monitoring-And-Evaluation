import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { OrganizationsService, type MemberKind } from './organizations.service';
import {
  organizationDetailsSchema,
  organizationMemberSchema,
  organizationResponseSchema,
  organizationWithMembersSchema,
  type OrganizationMemberDto,
} from './response/organization.response';
import { AllowedRoles, BaseResponseSchema, PaginatedResponseSchema, Public, paginated, paginationQuerySchema } from '@common';
import type { DataResponseDto, PaginatedResponseDto, PaginationQuery } from '@common';
import { UserRole } from '@common/enums';
import { OWNER_ROLES } from './organizations.enum';
import type { OrganizationDocument } from './organization.model';
import { CreateOrganizationSchema, type CreateOrganizationDto } from './dtos/create-organization.dto';
import { InviteMemberSchema, type InviteMemberDto } from './dtos/invite-employee.dto';

const organizationIdParam = ApiParam({ name: 'organizationId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' });

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @ApiOperation({ summary: 'List organizations, by name', description: 'Each organization with its name, type, owner id and creation date.' })
  @ApiResponse({ status: 200, standardSchema: PaginatedResponseSchema(organizationResponseSchema) })
  @Public()
  @Get()
  async listOrganizations(@Query({ schema: paginationQuerySchema }) query: PaginationQuery): Promise<PaginatedResponseDto<OrganizationDocument>> {
    return paginated('Organizations', await this.organizationsService.listOrganizations(query), query);
  }

  @ApiBearerAuth()
  @AllowedRoles([UserRole.SUPER_ADMIN])
  @ApiOperation({
    summary: 'Create an organization and invite its owner',
    description:
      'Creates the organization and a new user as its owner, with a role that depends on the organization type. The owner is emailed a link to set their password.',
  })
  @ApiResponse({ status: 201, standardSchema: BaseResponseSchema(organizationDetailsSchema) })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Not a super admin (hidden as not found)' })
  @ApiResponse({ status: 409, description: 'Organization or owner email already exists' })
  @Post()
  async createOrganization(@Body({ schema: CreateOrganizationSchema }) dto: CreateOrganizationDto): Promise<DataResponseDto<OrganizationDocument>> {
    return { message: 'Organization created successfully', data: await this.organizationsService.createOrganization(dto) };
  }

  @ApiBearerAuth()
  @AllowedRoles(Object.values(OWNER_ROLES))
  @ApiOperation({
    summary: 'An organization with its drivers and employees',
    description:
      'For a super admin or an organization owner. Employees are everyone in the organization except drivers, the owner included.',
  })
  @organizationIdParam
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(organizationWithMembersSchema) })
  @ApiResponse({ status: 400, description: 'Invalid organization id' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @Get(':organizationId')
  async getOrganization(
    @Param('organizationId', ParseObjectIdPipe) organizationId: Types.ObjectId,
  ): Promise<DataResponseDto<OrganizationDocument>> {
    return { message: 'Organization', data: await this.organizationsService.findOrganizationWithMembers(organizationId.toString()) };
  }

  @ApiBearerAuth()
  @AllowedRoles(Object.values(OWNER_ROLES))
  @ApiOperation({
    summary: 'Invite an employee into an organization',
    description:
      "For a super admin or an organization owner. The employee's role depends on the organization type: driver instructor for a driving school, fleet analyst for a fleet company, insurance analyst for an insurance company. They are emailed a link to set their password.",
  })
  @organizationIdParam
  @ApiResponse({ status: 201, standardSchema: BaseResponseSchema(organizationMemberSchema) })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Email already exists in the organization' })
  @Post(':organizationId/employees')
  inviteEmployee(
    @Param('organizationId', ParseObjectIdPipe) organizationId: Types.ObjectId,
    @Body({ schema: InviteMemberSchema }) dto: InviteMemberDto,
  ): Promise<DataResponseDto<OrganizationMemberDto>> {
    return this.inviteMember(organizationId, dto, 'employee');
  }

  @ApiBearerAuth()
  @AllowedRoles(Object.values(OWNER_ROLES))
  @ApiOperation({
    summary: 'Invite a driver into an organization',
    description: 'For a super admin or an organization owner. The driver is emailed a link to set their password.',
  })
  @organizationIdParam
  @ApiResponse({ status: 201, standardSchema: BaseResponseSchema(organizationMemberSchema) })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Email already exists in the organization' })
  @Post(':organizationId/drivers')
  inviteDriver(
    @Param('organizationId', ParseObjectIdPipe) organizationId: Types.ObjectId,
    @Body({ schema: InviteMemberSchema }) dto: InviteMemberDto,
  ): Promise<DataResponseDto<OrganizationMemberDto>> {
    return this.inviteMember(organizationId, dto, 'driver');
  }

  private async inviteMember(organizationId: Types.ObjectId, dto: InviteMemberDto, kind: MemberKind): Promise<DataResponseDto<OrganizationMemberDto>> {
    const member = await this.organizationsService.inviteMember(organizationId.toString(), dto, kind);
    return { message: kind === 'driver' ? 'Driver invited successfully' : 'Employee invited successfully', data: member };
  }
}
