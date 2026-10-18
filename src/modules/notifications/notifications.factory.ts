import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { Notification } from './notifications.model';
import { CreateNotificationDto } from './create-notification.dto';

@Injectable()
export class NotificationsFactory {
  createNotification(dto: CreateNotificationDto): Notification {
    const notification = new Notification();
    notification.recipient = new Types.ObjectId(dto.recipient);
    notification.type = dto.type;
    notification.trip = dto.trip ? new Types.ObjectId(dto.trip) : null;
    notification.incident = dto.incident ? new Types.ObjectId(dto.incident) : null;
    notification.params = dto.params;
    return notification;
  }
}
