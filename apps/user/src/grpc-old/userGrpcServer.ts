import * as grpc from "@grpc/grpc-js" // Thư viện gRPC cho Node.js


// Interface mô phỏng kiểu User trả về
interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Lớp định nghĩa các phương thức xử lý gRPC
export class UserGrpcService {
  async getUser(
    call: grpc.ServerUnaryCall<{ user_id: string }, any>, // call chứa input từ client
    callback: grpc.sendUnaryData<any> // callback trả response về cho client
  ) {
    try {
      const userId = call.request.user_id
      const user: User = {
        id: userId,
        username: 'john_doe',
        email: 'john@example.com',
        full_name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'user',
        status: 'active',
        created_at: Date.now().toString(),
        updated_at: Date.now().toString()
      };

      // Trả kết quả thành công
      callback(null, {
        success: true,
        message: 'User found',
        user
      })
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      } as grpc.ServiceError);
    }
  }

  async getUsers(
    call: grpc.ServerUnaryCall<{ user_ids: string[] }, any>,
    callback: grpc.sendUnaryData<any>
  ) {
    try {
      const userIds = call.request.user_ids;

      const users: User[] = userIds.map((id) => ({
        id,
        username: `user_${id}`,
        email: `user${id}@example.com`,
        full_name: `User ${id}`,
        first_name: 'User',
        last_name: id,
        avatar_url: `https://example.com/avatar${id}.jpg`,
        role: 'user',
        status: 'active',
        created_at: Date.now().toString(),
        updated_at: Date.now().toString()
      }));

      const userMap: Record<string, User> = {};
      users.forEach((user) => {
        userMap[user.id] = user;
      });

      callback(null, {
        success: true,
        message: `Found ${users.length} users`,
        users,
        user_map: userMap
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      } as grpc.ServiceError);
    }
  }

  async listUsers(
    call: grpc.ServerUnaryCall<{
      page?: number;
      limit?: number;
      search?: string;
      user_ids?: string[];
    }, any>,
    callback: grpc.sendUnaryData<any>
  ) {
    try {
      const { page = 1, limit = 10 } = call.request;

      const mockUsers: User[] = [
        {
          id: '1',
          username: 'john_doe',
          email: 'john@example.com',
          full_name: 'John Doe',
          first_name: 'John',
          last_name: 'Doe',
          avatar_url: 'https://example.com/avatar1.jpg',
          role: 'user',
          status: 'active',
          created_at: Date.now().toString(),
          updated_at: Date.now().toString()
        },
        {
          id: '2',
          username: 'jane_smith',
          email: 'jane@example.com',
          full_name: 'Jane Smith',
          first_name: 'Jane',
          last_name: 'Smith',
          avatar_url: 'https://example.com/avatar2.jpg',
          role: 'admin',
          status: 'active',
          created_at: Date.now().toString(),
          updated_at: Date.now().toString()
        }
      ];

      callback(null, {
        success: true,
        message: `Found ${mockUsers.length} users`,
        users: mockUsers,
        pagination: {
          page,
          limit,
          total: mockUsers.length,
          total_pages: Math.ceil(mockUsers.length / limit),
          has_next: page < Math.ceil(mockUsers.length / limit),
          has_prev: page > 1
        }
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      } as grpc.ServiceError);
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
