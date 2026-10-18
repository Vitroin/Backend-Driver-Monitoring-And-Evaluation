import { WebSocketGateway, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { NotificationsService } from './notifications.service';
import type { CreateNotificationDto } from './create-notification.dto';

@WebSocketGateway()
export class NotificationsGateway {
  constructor(private readonly notificationsService: NotificationsService) {}

  @SubscribeMessage('createNotification')
  create(@MessageBody() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @SubscribeMessage('findAllUserNotifications')
  findAll(@MessageBody() userId: string) {
    return this.notificationsService.findAllUserNotifications(userId);
  }

  @SubscribeMessage('findAllUnreadUserNotifications')
  findAllUnread(@MessageBody() userId: string) {
    return this.notificationsService.findAllUnreadUserNotifications(userId);
  }

  @SubscribeMessage('markNotificationAsRead')
  markAsRead(@MessageBody() notificationId: string) {
    return this.notificationsService.markNotificationAsRead(notificationId);
  }

  @SubscribeMessage('markAllNotificationsAsReadForUser')
  markAllAsRead(@MessageBody() userId: string) {
    return this.notificationsService.markAllNotificationsAsReadForUser(userId);
  }
}
