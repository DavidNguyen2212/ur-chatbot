import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";


@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();

    const user = client.data?.user;

    if (!user) {                 // Chưa login ⇒ block
      throw new WsException({
        error: 'Unauthorized',
        message: 'Socket unauthenticated',
        statusCode: 401,
      });
    }

    // (Tuỳ chọn) kiểm tra hết hạn => Cho phép bỏ qua lần xử lý này
    if (user.exp && Date.now() / 1000 > user.exp) {
      this.logger.log(`Token expired on Socket client id:${client.id}`)
      client.emit('auth:expired');
      // client.disconnect(true); // Nhưng không ngắt kết nối socket, đợi hot-swap
      return false;
    }

    return true;            
  }
}