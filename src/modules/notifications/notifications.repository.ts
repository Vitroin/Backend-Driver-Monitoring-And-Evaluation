import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './notifications.model';

@Injectable()
export class NotificationsRepository extends BaseRepository<Notification> {
  constructor(@InjectModel('Notification') private readonly notificationModel: Model<Notification>) {
    super(notificationModel);
  }

  async findNotificationsByUserId(userId: string) {
    return this.notificationModel.find({ userId }).exec();
  }

  async findUnreadNotificationsByUserId(userId: string) {
    return this.notificationModel.find({ userId, read: false }).exec();
  }

  async markNotificationAsRead(notificationId: string) {
    return this.notificationModel.findByIdAndUpdate(notificationId, { read: true }, { new: true }).exec();
  }

  async markAllNotificationsAsReadForUser(userId: string) {
    return this.notificationModel.updateMany({ userId, read: false }, { read: true }).exec();
  }
}
