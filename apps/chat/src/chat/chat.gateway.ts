import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsException,
    WsResponse,
  } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { WsJwtGuard } from '../common/guards/ws.guard'; 
import { WsAuthenticatedUser } from '../common/interfaces/ws-auth'; 
import { WsUser } from '../common/decorators/ws-user.decorator'; 
import { WsRoleGuard } from '../common/guards/ws-role.guard'; 
import { Roles } from '../common/decorators/roles.decorator';
import { extractJwtFromSocket } from '../common/utils/ws-jwt-extractor.util'; 
import { ChatService } from './chat.service';
import { CoolJwtPayload } from '../common/interfaces/payload';
import { ChatbotService } from '../chatbot/chatbot.service';

@WebSocketGateway({
    namespace: '/chat/customer',
    transports: ['websocket'],
    cors: { origin: ['*'], credentials: true },
  })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() 
  server: Server;
  
  private readonly logger = new Logger(ChatGateway.name)
  // Deprecated. Now user RedisAdapter and Room messaging
  // private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds
  constructor(
    private readonly jwt: JwtService,
    private readonly chatService: ChatService,
    private readonly chatbotService: ChatbotService,
  ) {}
  /**
   * Implement WebSocket's Authorization 
   * - While handshaking
   * - On refreshing (hot-swap)
   * @param server 
   */
  async afterInit(server: Server) {
    this.logger.log('ChatGateway initialized in public mode (no JWT)');
  }

  /**
   * Implement WebSocket's Connection
   * - Establish connection
   * - Add current socket to connected users
   * @param client: `Socket`
   */
  async handleConnection(client: Socket) {
    try {      
      const token = client.handshake.query.token as string;
      const orgId = client.handshake.query.orgId as string;
      const sessionId = client.handshake.query.sessionId as string;

      this.logger.log(`Client ${client.id} attempting to connect with token=${token}, orgId=${orgId}, sessionId=${sessionId}`);

      const config = await this.chatbotService.getChatbotConfigByOrgAndToken(orgId, token); // bạn cần viết hàm này
      if (!config) {
        throw new WsException('Invalid token or orgId');
      }

      // Gắn thông tin config vào socket
      client.data.orgId = orgId;
      client.data.sessionId = sessionId;
      client.data.token = token;

      // Join rooms
      await client.join(`org:${orgId}`);
      await client.join(`session:${sessionId}`);

      client.emit('connection:established', {
        message: 'Connection established',
        socketId: client.id,
        orgId,
        sessionId,
        timestamp: new Date()
      });

      this.logger.log(`✅ Socket ${client.id} connected to org:${orgId}, session:${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Connection error for ${client.id}: ${error.message}`);
      client.emit('connection:error', {
        message: 'Unauthorized',
        error: error.message
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const orgId = client.data?.orgId;
    const sessionId = client.data?.sessionId;
    this.logger.log(`Client ${client.id} disconnected from org:${orgId}, session:${sessionId}`);
  }

    /**
   * Gửi một message đến tất cả clients trong room
   * @param roomName tên phòng socket.io (ví dụ: 'chat_abc123', 'user:xyz')
   * @param payload nội dung muốn gửi
   * @param event tên sự kiện gửi (mặc định: 'message')
   */
  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      content: string;
      sender_type: string;
      sender_id?: string;
    }
  ) {
    const conversationId = socket.data.conversationId;
    const room = `chat_${conversationId}`;
    // Chặn nếu AI đang khởi tạo (ví dụ check flag trong service)
    if (await this.chatService.isAiInitializing(conversationId)) {
      socket.emit('error', {
        type: 'error',
        message: 'AI đang khởi tạo, vui lòng đợi trong giây lát.',
      });
      return;   
    }

    // Lưu DB
    const message = await this.chatService.saveMessage({
      conversationId,
      ...data,
    });

    // Broadcast message tới tất cả user khác (trừ người gửi)
    socket.to(room).emit('message', { type: 'message', message });
  } 

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    data: {
      is_typing: boolean;
      name: string;
    },
  ) {
    const conversationId = socket.data.conversationId;
    const room = `chat_${conversationId}`;

    socket.to(room).emit('typing', {
      type: 'typing',
      name: data.name || 'Ai đó',
      is_typing: data.is_typing,
    });
  }

   // Optional: Xử lý mode_change nếu cần
  @SubscribeMessage('mode_change')
  async handleModeChange(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { mode: string },
  ) {
    const conversationId = socket.data.conversationId;
    const room = `chat_${conversationId}`;

    this.server.to(room).emit('mode_change', {
      type: 'mode_change',
      mode: data.mode,
    });
  }

  // Message handlers với guards
  @SubscribeMessage('notification:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @WsUser() user: WsAuthenticatedUser,
    @MessageBody() data: { categories: string[] }
  ) {
    // Join user to their personal room
    client.join(`user:${user.userId}`);
    
    // Join category rooms
    data.categories.forEach(category => {
      client.join(`category:${category}`);
    });
    
    this.logger.log(`User ${user.email} subscribed to: ${data.categories.join(', ')}`);
    
    return {
      event: 'notification:subscribed',
      data: { 
        categories: data.categories,
        user: {
          id: user.userId,
          email: user.email,
          roles: user.organization?.role
        }
      }
    };
  }

//   @SubscribeMessage('notification:unsubscribe')
//   @UseGuards(WsJwtGuard)
//   handleUnsubscribeFromNotifications(
//     @ConnectedSocket() client: Socket,
//     @WsUser() user: WsAuthenticatedUser,
//     @MessageBody() data: { categories?: string[] }
//   ) {
//     const { categories = [] } = data;
    
//     categories.forEach(category => {
//       client.leave(`category:${category}`);
//     });
    
//     this.logger.log(`User ${user.id} unsubscribed from categories: ${categories.join(', ')}`);
    
//     client.emit('notification:unsubscribed', {
//       message: 'Successfully unsubscribed',
//       categories,
//       userId: user.userId
//     });
//   }

//   @SubscribeMessage('notification:mark-read')
//   @UseGuards(WsJwtGuard)
//   handleMarkAsRead(
//     @ConnectedSocket() client: Socket,
//     @WsUser() user: WsAuthenticatedUser,
//     @MessageBody() data: { notificationId: string }
//   ) {
//     // Logic để mark notification as read
//     this.logger.log(`User ${user.id} marked notification ${data.notificationId} as read`);
    
//     client.emit('notification:marked-read', {
//       notificationId: data.notificationId,
//       userId: user.id
//     });
//   }

//   // Public methods để gửi notification
//   async sendNotificationToUser(userId: string, notification: any) {
//     const room = `user:${userId}`
//     const sockets = await this.server.in(room).fetchSockets()

//     if (sockets.length > 0) {
//       this.server.to(room).emit('notification', notification)
//       this.logger.log(`Sent notification to user ${userId} on ${sockets.length} devices`)
//       return true
//     } else {
//       this.logger.warn(`User ${userId} is not connected`);
//       return false;
//     }
//   }

//   sendToCategory(category: string, data: NotificationRecipientDTO) {
//     this.server.to(`category:${category}`).emit('notification:new', data);
//     this.logger.log(`Sent notification to category: ${category}`);
//   }

//   broadcastToAll(data: NotificationRecipientDTO) {
//     this.server.emit('notification:broadcast', data);
//     this.logger.log('Broadcasted notification to all users');
//   }

  /**
   * Send notification to users with specific role
   */
  async sendNotificationToRole(role: string, notification: any) {
    const room = `role:${role}`;
    this.server.to(room).emit('notification', notification);
    this.logger.log(`Sent notification to role: ${role}`);
  }

  // Utility methods
  /**
   * Get all online users (for admin dashboard)
  */
  async getOnlineUsers(): Promise<string[]> {
    const sockets = await this.server.fetchSockets();
    const onlineUsers = new Set<string>();
    
    sockets.forEach(socket => {
      const userId = socket.data?.user?.id;
      if (userId) {
        onlineUsers.add(userId);
      }
    });
    
    return Array.from(onlineUsers);
  }

  /**
   * Get user's active device count
  */
  async getUserDeviceCount(userId: string): Promise<number> {
    const room = `user:${userId}`;
    const sockets = await this.server.in(room).fetchSockets();
    return sockets.length;
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const room = `user:${userId}`;
    const sockets = await this.server.in(room).fetchSockets();
    return sockets.length > 0;
  }

  /**
   * Force disconnect user from all devices
   */
  async disconnectUser(userId: string, reason?: string) {
    const room = `user:${userId}`;
    const sockets = await this.server.in(room).fetchSockets();
    
    for (const socket of sockets) {
      socket.emit('force:disconnect', { reason: reason || 'Disconnected by admin' });
      socket.disconnect(true);
    }
    
    this.logger.log(`Force disconnected user ${userId} from ${sockets.length} devices`);
  }
}