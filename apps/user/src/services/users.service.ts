import { ErrorWithStatus } from "../interfaces/Errors"
import { uploadFileToS3 } from "../infra/s3/s3.upload"
import { UpdateUserInput, UserInfoResponse, UserWithDetails } from "../interfaces/user"
import { UserRepository } from "../repositories/user.repository"
import { UserName } from "../generated/user_service";


class UsersService {
  constructor(private userRepo: UserRepository) {}
  async getUserInfo(userId: string): Promise<UserWithDetails> {
    const user = await this.userRepo.findByIdWithDetails(userId);
    
    if (!user) {
      throw new ErrorWithStatus({
        message: "User not found",
        status: 404
      });
    }
    
    return user;
  }

  async updateUserInfo({ userId, name, phone, avatar }: UpdateUserInput): Promise<UserInfoResponse> {
    // Check if user exists
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    // Handle avatar upload if provided
    let newAvatarKey = user.avatar ?? null;
    if (avatar) {
      newAvatarKey = `avatar/${userId}`;
      await uploadFileToS3({
        contentType: avatar.mimetype,
        filename: newAvatarKey,
        filestream: avatar.buffer
      });
    }

    // Update user data
    const updatedUser = await this.userRepo.update(userId, {
      name,
      phone,
      avatar: newAvatarKey
    });

    // Return formatted response
    return {
      email: updatedUser.email,
      name: updatedUser.name || '',
      phone_number: updatedUser.phone || '',
      avatar: updatedUser.avatar
    };
  }

  async getUsersInfo(userId: string): Promise<UserWithDetails> {
    const user = await this.userRepo.findByIdWithDetails(userId);
    
    if (!user) {
      throw new ErrorWithStatus({
        message: "User not found",
        status: 404
      });
    }
    
    return user;
  }

  
  async proto_getNames(userIds: string[]): Promise<Map<string, UserName>> {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new Map();
    }

    // Remove duplicates and filter out empty strings
    const uniqueUserIds = [...new Set(userIds)].filter(id => id && id.trim());
    if (uniqueUserIds.length === 0) {
      return new Map();
    }

    const users = await this.userRepo.findNamesByIds(uniqueUserIds);
    const nameMap = new Map<string, UserName>();
    users.forEach(user => {
      nameMap.set(user.id, { name: user.name });
    });

    // Add null entries for userIds that weren't found
    uniqueUserIds.forEach(userId => {
      if (!nameMap.has(userId)) {
        nameMap.set(userId, {});
      }
    });

    return nameMap;
  }
}

const usersService = new UsersService(new UserRepository())
export default usersService