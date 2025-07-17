import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

// Hàm dùng chung để load .proto
const loadProto = (protoRelativePath: string) => {
  const protoPath = path.join(__dirname, protoRelativePath);
  const definition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  return grpc.loadPackageDefinition(definition);
}

// Load từng service cụ thể
const userProtoPath: string = './proto/user_service.proto'
export const userProto = loadProto(userProtoPath) as any;