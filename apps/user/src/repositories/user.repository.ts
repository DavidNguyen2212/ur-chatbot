import { User } from "@prisma/client";
import { prisma } from "../infra/prisma/prisma.client";
import { UpdateUserData, UserWithDetails } from "../interfaces/user";

interface IUserRepository {
  findById(userId: string): Promise<Partial<User> | null>;
  findByIdWithDetails(id: string): Promise<UserWithDetails | null>;
  update(userId: string, data: Partial<Pick<User, "name" | "phone" | "avatar">>): Promise<User>;
}

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  async findByIdWithDetails(id: string): Promise<UserWithDetails | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organizationMembers: {
          include: { organization: true }
        }
        // Do not include emailVerificationTokens, organizationInvites
      }
    });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return prisma.$transaction(async (tx) => {
      return tx.user.update({
        where: { id },
        data
      });
    });
  }


  /**
   * 
   * PROTO METHODS
   * 
   */
  async findNamesByIds(userIds: string[]): Promise<{ id: string; name: string }[]> {
    if (userIds.length === 0) {
      return [];
    }

    return prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        name: true
      }
    });
  }
}