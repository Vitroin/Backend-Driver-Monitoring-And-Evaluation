import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { BaseResponseSchema, CurrentUser, PaginatedResponseSchema, paginated } from '@common';
import type { DataResponseDto, PaginatedResponseDto } from '@common';
import { NotificationsService } from './notifications.service';
import type { NotificationDocument } from './notifications.model';
import {
  listNotificationsQuerySchema,
  markedAllReadSchema,
  notificationSchema,
  type ListNotificationsQueryDto,
} from './notification.response';

// The logged-in user's own notifications. New ones are also pushed over the socket (see NotificationsGateway).
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: "The logged in user's notifications, newest first" })
  @ApiResponse({ status: 200, standardSchema: PaginatedResponseSchema(notificationSchema) })
  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query({ schema: listNotificationsQuerySchema }) { unread, page, limit }: ListNotificationsQueryDto,
  ): Promise<PaginatedResponseDto<NotificationDocument>> {
    return paginated('Notifications', await this.notificationsService.list(userId, unread, { page, limit }), { page, limit });
  }

  @ApiOperation({ summary: 'Mark every notification of the logged in user read' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(markedAllReadSchema) })
  @Patch('read-all')
  async markAllAsRead(@CurrentUser('id') userId: string): Promise<DataResponseDto<{ updated: number }>> {
    return { message: 'All notifications marked as read', data: { updated: await this.notificationsService.markAllAsRead(userId) } };
  }

  @ApiParam({ name: 'notificationId', type: String, example: '665f1c2e8b3e4a1d2c9f0a12' })
  @ApiOperation({ summary: 'Mark one notification read', description: 'Marking one that is already read changes nothing.' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(notificationSchema) })
  @ApiResponse({ status: 404, description: "Notification not found, or not the logged in user's" })
  @Patch(':notificationId/read')
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('notificationId', ParseObjectIdPipe) notificationId: Types.ObjectId,
  ): Promise<DataResponseDto<NotificationDocument>> {
    return { message: 'Notification marked as read', data: await this.notificationsService.markAsRead(userId, notificationId.toString()) };
  }
}
