import * as grpc from '@grpc/grpc-js';
import { UserGrpcService } from './userGrpcServer';
import { UserServiceService } from '../generated/user_service';
import { logger } from '../utils/logger';

// code này sử dụng ts-proto để gen. dùng proto loader cực quá

// Hàm khởi tạo server gRPC và bind các service
export function startGrpcServer(port = '0.0.0.0:50051') {
  logger.info('Start gRPC server...');
  const server = new grpc.Server();
  const userServiceImpl = new UserGrpcService();

  // Gắn service User vào server
  server.addService(UserServiceService, userServiceImpl);

  // Bắt đầu server
  server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, actualPort) => {
    if (err) {
      logger.error('❌ Failed to start gRPC server:', err);
      return;
    }
    logger.info(`🚀 gRPC User Service (Server) running at ${actualPort}`);
  });

  return server;
}
