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

  findAllUserNotifications(uerId: string) {
    const notifications = this.notificationsRepository.findNotificationsByUserId('userId'); // Replace 'userId' with the actual user ID
    if (!notifications) {
      return { message: 'No notifications found for the user', data: [] };
    }
    return { message: 'Notifications retrieved successfully', data: notifications };
  }

  findAllUnreadUserNotifications(userId: string) {
    const unreadNotifications = this.notificationsRepository.findUnreadNotificationsByUserId(userId);
    if (!unreadNotifications) {
      return { message: 'No unread notifications found for the user', data: [] };
    }
    return { message: 'Unread notifications retrieved successfully', data: unreadNotifications };
  }

  markNotificationAsRead(notificationId: string) {
    const updatedNotification = this.notificationsRepository.markNotificationAsRead(notificationId);
    if (!updatedNotification) {
      return { message: 'Notification not found or already marked as read', data: null };
    }
    return { message: 'Notification marked as read successfully', data: updatedNotification };
  }

  markAllNotificationsAsReadForUser(userId: string) {
    const result = this.notificationsRepository.markAllNotificationsAsReadForUser(userId);
    if (result === null) {
      return { message: 'No unread notifications found for the user', data: null };
    }
    return { message: 'All notifications marked as read successfully', data: result };
  }
}
