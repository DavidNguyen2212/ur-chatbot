import * as grpc from '@grpc/grpc-js';
import { UserGrpcService } from './userGrpcServer';
import { userProto } from './protoLoader';

// Hàm khởi tạo server gRPC và bind các service
export function startGrpcServer(port = '0.0.0.0:50051') {
  const server = new grpc.Server();
  const userService = new UserGrpcService();

  // Gắn service User vào server
  server.addService(userProto.user_service.UserService.service, {
    getUser: userService.getUser.bind(userService),
    getUsers: userService.getUsers.bind(userService),
    listUsers: userService.listUsers.bind(userService)
  });

  // Bắt đầu server
  server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, actualPort) => {
    if (err) {
      console.error('❌ Failed to start gRPC server:', err);
      return;
    }
    console.log(`🚀 gRPC User Service running at ${actualPort}`);
  });

  return server;
}
