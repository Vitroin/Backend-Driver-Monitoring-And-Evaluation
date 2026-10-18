import { NotificationsFactory } from './notifications.factory';
import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { CreateNotificationDto } from './create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationsFactory: NotificationsFactory,
  ) {}

  async create(dto: CreateNotificationDto) {
    try {
      // Logic to create a notification
      const notification = this.notificationsFactory.createNotification(dto);
      const saved = await this.notificationsRepository.create(notification);
      return { message: 'Notification created successfully', data: saved };
    } catch (error) {
      return { message: 'Error creating notification', error: error instanceof Error ? error.message : String(error) };
    }
  }

  async findAllUserNotifications(userId: string) {
    const notifications = await this.notificationsRepository.findNotificationsByUserId(userId);
    if (!notifications) {
      return { message: 'No notifications found for the user', data: [] };
    }
    return { message: 'Notifications retrieved successfully', data: notifications };
  }

  async findAllUnreadUserNotifications(userId: string) {
    const unreadNotifications = await this.notificationsRepository.findUnreadNotificationsByUserId(userId);
    if (!unreadNotifications) {
      return { message: 'No unread notifications found for the user', data: [] };
    }
    return { message: 'Unread notifications retrieved successfully', data: unreadNotifications };
  }

  async markNotificationAsRead(notificationId: string, userId: string) {
    const updatedNotification = await this.notificationsRepository.markNotificationAsRead(notificationId, userId);
    if (!updatedNotification) {
      return { message: 'Notification not found or already marked as read', data: null };
    }
    return { message: 'Notification marked as read successfully', data: updatedNotification };
  }

  async markAllNotificationsAsReadForUser(userId: string) {
    const result = await this.notificationsRepository.markAllNotificationsAsReadForUser(userId);
    if (result.modifiedCount === 0) {
      return { message: 'No unread notifications found for the user', data: null };
    }
    return { message: 'All notifications marked as read successfully', data: result };
  }
}
