export interface RegisterOrgBody {
  // Org field
  org_name: string
  description: string
  contact_email: string
  contact_phone: string
  // User field
  user_email: string
  user_phone: string
  user_name: string
  password: string
  confirm_password: string
}

export interface JoinOrgBody {
  invite_code: string
  password: string
  confirm_password: string
  name: string
  phone: string
}

export interface VerifyEmailBody {
  token: string
}

export interface LoginBody {
  email: string
  password: string
  org_contact_email?: string
}

export interface RefreshBody {
  refresh: string
}

export interface ResetPasswordReqBody {
  email: string
}

export interface ResetPasswordBody {
  token: string
  password: string
  confirm_password: string
}

export interface ChangePasswordBody {
  current_password: string
  new_password: string
  confirm_new_password: string
}