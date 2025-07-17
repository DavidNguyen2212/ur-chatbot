import { ServerUnaryCall, sendUnaryData, ServiceError, status } from "@grpc/grpc-js" // Thư viện gRPC cho Node.js
import { UserServiceServer, GetUsersResponse, GetUsersRequest, UserName } from '../generated/user_service';
import { logger } from "../utils/logger";
import usersService from "../services/users.service";

// Lớp định nghĩa các phương thức xử lý gRPC
export class UserGrpcService implements UserServiceServer {
  [method: string]: any; // 👈 cần để TypeScript không lỗi "missing methods"

  async getUserNames(
    call: ServerUnaryCall<GetUsersRequest, GetUsersResponse>,
    callback: sendUnaryData<GetUsersResponse>
  ) {
    logger.info(`[UserGrpcService] - Server: Invoke getUserNames`)
    try {
      const userIds = call.request.userIds;
      logger.info(userIds)
      const userMap = await usersService.proto_getNames(userIds) 

      callback(null, {
        userMap: Object.fromEntries(userMap)
      });
    } catch (error: any) {
      callback(
        {
          code: status.INTERNAL,
          message: error.message
        } as ServiceError
      );
    }
  }

}

// Hàm khởi động server gRPC
// export function startGrpcServer(port: string = '0.0.0.0:50051') {
//   const server = new grpc.Server();
//   const userGrpcService = new UserGrpcService();

//   // Gán các method vào service được định nghĩa trong .proto
//   server.addService(
//     // userServiceDeflà object được load từ file proto (bằng load definition)
//     // UserService là tên service ta định nghĩa trong proto
//     // .service là property chứa thông tin mô tả các method, kiểu dữ liệu request/response, v.v... để gRPC server biết cách map các method.
//     userServiceDef.UserService.service,
//     /**
//      * Đây là object ánh xạ tên method (phải trùng với tên trong file proto, nhưng viết thường chữ cái đầu) tới hàm xử lý thực tế trong code.
//      * 
//      * .bind(userGrpcService) để đảm bảo từ khóa this trong hàm luôn trỏ đúng về instance của class, tránh lỗi khi truy cập thuộc tính hoặc method khác trong class.
//      */
//     {
//       getUser: userGrpcService.getUser.bind(userGrpcService),
//       getUsers: userGrpcService.getUsers.bind(userGrpcService),
//       listUsers: userGrpcService.listUsers.bind(userGrpcService)
//     }
//   )

//   // Khởi động server
//   server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, actualPort) => {
//     if (err) {
//       console.error('Failed to bind gRPC server:', err);
//       return;
//     }
//     console.log(`✅ gRPC User Service running at ${actualPort}`);
//   })
// }
