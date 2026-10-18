import { ArgumentsHost, Catch, HttpException, UseFilters } from '@nestjs/common';
import {
  BaseWsExceptionFilter,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { CurrentUser } from '@common';
import { objectIdSchema } from '@common/types';
import { NotificationsService } from './notifications.service';
import { CreateNotificationSchema, type CreateNotificationDto } from './create-notification.dto';

/** Sends guard and validation errors (401, 403, 400) to the client as they are, instead of "Internal server error". */
@Catch(HttpException)
class HttpToWsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    super.catch(new WsException(exception.getResponse()), host);
  }
}

@UseFilters(new HttpToWsExceptionFilter())
@WebSocketGateway()
export class NotificationsGateway implements OnGatewayInit {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * The global AuthenticationGuard reads `request.headers.authorization` and sets `request.user`, and for a socket
   * message the "request" is the socket. Copying the handshake's token to `socket.headers` lets it check every message
   * like an HTTP request, and @CurrentUser then reads the user it sets on the socket.
   * Clients connect with `io(url, { auth: { token: 'Bearer <accessToken>' } })` or an Authorization header.
   */
  afterInit(server: Server) {
    server.use((socket, next) => {
      const { auth, headers } = socket.handshake;
      (socket as Socket & { headers: { authorization?: string } }).headers = {
        authorization: typeof auth.token === 'string' ? auth.token : headers.authorization,
      };
      next();
    });
  }

  @SubscribeMessage('createNotification')
  create(@MessageBody({ schema: CreateNotificationSchema }) createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @SubscribeMessage('findAllUserNotifications')
  findAll(@CurrentUser('id') userId: string) {
    return this.notificationsService.findAllUserNotifications(userId);
  }

  @SubscribeMessage('findAllUnreadUserNotifications')
  findAllUnread(@CurrentUser('id') userId: string) {
    return this.notificationsService.findAllUnreadUserNotifications(userId);
  }

  @SubscribeMessage('markNotificationAsRead')
  markAsRead(@MessageBody({ schema: objectIdSchema }) notificationId: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markNotificationAsRead(notificationId, userId);
  }

  @SubscribeMessage('markAllNotificationsAsReadForUser')
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllNotificationsAsReadForUser(userId);
  }
}
