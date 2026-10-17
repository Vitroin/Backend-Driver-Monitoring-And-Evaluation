import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BaseResponseSchema, CurrentUser } from '@common';
import type { DataResponseDto, MessageResponseDto } from '@common';
import { objectIdSchema } from '@common/types';
import { UsersService } from './users.service';
import { updateFullNameSchema, type UpdateFullNameDto } from './update-full-name.dto';
import { fullNameResponseSchema, type FullNameResponseDto } from './response/full-name.response';

// Every route here acts on the logged in user's own account, whatever their role
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Change the logged in user full name', description: 'The name shown to evaluators and in reports.' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(fullNameResponseSchema) })
  @ApiResponse({ status: 400, description: 'Invalid full name' })
  @Patch('me/full-name')
  updateFullName(
    @CurrentUser('id') userId: string,
    @Body({ schema: updateFullNameSchema }) { fullName }: UpdateFullNameDto,
  ): Promise<DataResponseDto<FullNameResponseDto>> {
    return this.usersService.updateFullName(userId, fullName);
  }

  @ApiOperation({
    summary: "Ask for the logged in user's account and data to be deleted",
    description: 'An administrator then deletes the data. Repeating the request keeps the first request date.',
  })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema() })
  @HttpCode(HttpStatus.OK)
  @Post('me/deletion-request')
  requestDeletion(@CurrentUser('id') userId: string): Promise<MessageResponseDto> {
    return this.usersService.requestDeletion(userId);
  }

  @ApiOperation({
    summary: 'The organizations the logged in user is enrolled in',
    description: 'Returns the organization ids only.',
  })
  @ApiResponse({
    status: 200,
    standardSchema: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }).array(),
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get('me/organizations')
  enrolledOrganizations(@CurrentUser('id') userId: string) {
    return this.usersService.showEnrolledOrganizations(userId);
  }

}
