import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationSchema } from './notifications.model';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsFactory } from './notifications.factory';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Notification', schema: NotificationSchema }])],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService, NotificationsRepository, NotificationsFactory],
})
export class NotificationsModule {}
