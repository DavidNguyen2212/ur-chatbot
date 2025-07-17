import asyncio
import grpclib.client
from typing import List, Dict, Optional
from uuid import UUID
from app.core.logger import get_logger
from app.generated import user_service_pb2
from app.generated.user_service_grpc import UserServiceStub
from app.generated.user_service_p2p import GetUsersResponse

from google.protobuf.json_format import MessageToDict
# from app.generated.user_service_p2p import GetUsersRequest

logger = get_logger()

class UserServiceClient:
    def __init__(self, host: str = "localhost", port: int = 50051):
        self.host = host
        self.port = port
        self.channel = None
        self.stub = None
   
    async def __aenter__(self):
        self.channel = grpclib.client.Channel(self.host, self.port)
        self.stub = UserServiceStub(self.channel)
        return self
   
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.channel:
            self.channel.close()
   
    async def get_users(self, user_ids: List[str]):
        """Get multiple users by IDs (batch operation)"""
        try:
            # Sử dụng method từ betterproto stub
            request = user_service_pb2.GetUsersRequest(user_ids=user_ids)
            proto_resp = await self.stub.GetUserNames(request)
            logger.info(f"gRPC response: {proto_resp}")
            
            dict_resp = MessageToDict(proto_resp, preserving_proto_field_name=True)
            logger.info(f"Dict response: {dict_resp}")

            pyd_resp = GetUsersResponse.model_validate(dict_resp)
            logger.info(f"Pydantic response: {pyd_resp}")
            # result = {
            #     uid: wrapper.value
            #     for uid, wrapper in response.user_map.items()
            #     if wrapper is not None
            # }
            return pyd_resp
               
        except grpclib.exceptions.GRPCError as e:
            logger.error(f"gRPC error getting users {user_ids}: {e}")
            return {}
        except Exception as e:
            logger.error(f"Unexpected error getting users {user_ids}: {e}")
            return {}
               

class UserServiceManager:
    _instance = None
    _client_config = {"host": "localhost", "port": 50051}
   
    @classmethod
    def configure(cls, host: str, port: int):
        cls._client_config = {"host": host, "port": port}
   
    @classmethod
    def get_client(cls) -> UserServiceClient:
        return UserServiceClient(**cls._client_config)

# Helper functions for common operations
async def get_users_names(user_ids: List[str]):
    """Get multiple users' display names"""
    async with UserServiceManager.get_client() as client:
        logger.info(user_ids)
        result = await client.get_users(user_ids)
        logger.info(result)
        return result.user_map
         


# For grpc
def setup_user_service(host, port):
    """Setup user service configuration"""
    user_service_host = host or "localhost"
    user_service_port = port or 50051
    
    UserServiceManager.configure(user_service_host, user_service_port)

# Example usage
# async def main():
#     # Configure the service
#     UserServiceManager.configure("localhost", 50051)
    
#     # Test single user
#     user_name = await get_user_name("user123")
#     print(f"User name: {user_name}")
    
#     # Test multiple users
#     user_names = await get_users_names(["user1", "user2", "user3"])
#     print(f"User names: {user_names}")

# if __name__ == "__main__":
#     asyncio.run(main())