import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllowedRoles, BaseResponseSchema, CurrentUser, PaginatedResponseSchema, paginated } from '@common';
import type { DataResponseDto, MessageResponseDto, PaginatedResponseDto } from '@common';
import { UserRole } from '@common/enums';
import { UsersService } from './users.service';
import { updateFullNameSchema, type UpdateFullNameDto } from './update-full-name.dto';
import { listUsersQuerySchema, type ListUsersQueryDto } from './list-users.dto';
import { fullNameResponseSchema, type FullNameResponseDto } from './response/full-name.response';
import { userListItemSchema, userOrganizationSchema, type UserOrganizationDto } from './response/user.response';
import type { UserDocument } from './user.model';

@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @AllowedRoles([UserRole.SUPER_ADMIN])
  @ApiOperation({ summary: 'List users, newest first', description: 'Super admins only. Filter by role and/or organization.' })
  @ApiResponse({ status: 200, standardSchema: PaginatedResponseSchema(userListItemSchema) })
  @ApiResponse({ status: 400, description: 'Invalid query' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Not a super admin (hidden as not found)' })
  @Get()
  async listUsers(@Query({ schema: listUsersQuerySchema }) query: ListUsersQueryDto): Promise<PaginatedResponseDto<UserDocument>> {
    return paginated('Users', await this.usersService.listUsers(query), query);
  }

  @ApiOperation({ summary: 'Change the logged in user full name', description: 'The name shown to evaluators and in reports.' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(fullNameResponseSchema) })
  @ApiResponse({ status: 400, description: 'Invalid full name' })
  @Patch('me/full-name')
  async updateFullName(
    @CurrentUser('id') userId: string,
    @Body({ schema: updateFullNameSchema }) { fullName }: UpdateFullNameDto,
  ): Promise<DataResponseDto<FullNameResponseDto>> {
    return { message: 'Full name updated successfully', data: await this.usersService.updateFullName(userId, fullName) };
  }

  @ApiOperation({
    summary: "Ask for the logged in user's account and data to be deleted",
    description: 'An administrator then deletes the data. Repeating the request keeps the first request date.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema() })
  @HttpCode(HttpStatus.OK)
  @Post('me/deletion-request')
  async requestDeletion(@CurrentUser('id') userId: string): Promise<MessageResponseDto> {
    const recorded = await this.usersService.requestDeletion(userId);
    return { message: recorded ? 'Your deletion request was recorded' : 'Your deletion request was already recorded' };
  }

  @ApiOperation({ summary: 'The organization the logged in user belongs to' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(userOrganizationSchema) })
  @Get('me/organization')
  async myOrganization(@CurrentUser('id') userId: string): Promise<DataResponseDto<UserOrganizationDto>> {
    return { message: 'Organization', data: await this.usersService.findOrganizationOf(userId) };
  }
}
