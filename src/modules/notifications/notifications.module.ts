import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationSchema } from './notifications.model';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsFactory } from './notifications.factory';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Notification', schema: NotificationSchema }])],
  providers: [NotificationsGateway, NotificationsService, NotificationsRepository, NotificationsFactory],
})
export class NotificationsModule {}
