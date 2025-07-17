export interface CoolJwtPayload {
  userId: string;
  email: string;
  organization?: {
    id: string;
    name: string;
    role: string;
  };
  jti?: string;
}

export interface UpdateUserInput {
  userId: string
  name?: string
  phone?: string
  avatar?: Express.Multer.File
}

export interface UserWithDetails {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationMembers: {
    organization: {
      id: string;
      name: string;
      // Add other organization fields as needed
    };
  }[];
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  avatar?: string;
}

export interface UserInfoResponse {
  email: string;
  name: string;
  phone_number: string;
  avatar: string | null;
}