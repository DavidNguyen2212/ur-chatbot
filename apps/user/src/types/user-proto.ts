// Định nghĩa user cơ bản
export interface User {
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

// Kết quả trả về cho getUser
export interface UserResponse {
  success: boolean;
  message: string;
  user: User | null;
}

// Kết quả trả về cho getUsers
export interface GetUsersResponse {
  success: boolean;
  message: string;
  users: User[];
  user_map: Record<string, User>;
}

// Kết quả trả về cho listUsers
export interface ListUsersResponse {
  success: boolean;
  message: string;
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
