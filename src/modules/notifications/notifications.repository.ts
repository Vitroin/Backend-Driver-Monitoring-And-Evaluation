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
    return this.notificationModel.find({ recipient: userId }).sort({ createdAt: -1 }).exec();
  }

  async findUnreadNotificationsByUserId(userId: string) {
    return this.notificationModel.find({ recipient: userId, readAt: null }).sort({ createdAt: -1 }).exec();
  }

  // recipient so users can't mark someone else's; readAt: null so one that's already read returns null instead of getting a new readAt
  async markNotificationAsRead(notificationId: string, userId: string) {
    return this.notificationModel
      .findOneAndUpdate({ _id: notificationId, recipient: userId, readAt: null }, { readAt: new Date() }, { new: true })
      .exec();
  }

  async markAllNotificationsAsReadForUser(userId: string) {
    return this.notificationModel.updateMany({ recipient: userId, readAt: null }, { readAt: new Date() }).exec();
  }
}
