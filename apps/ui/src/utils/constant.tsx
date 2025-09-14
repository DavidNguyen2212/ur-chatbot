import type { ChatMode } from "../types/widget.types";

export const STORAGE_KEYS = {
    CHAT_MODE: 'coolchat_mode',
    CUSTOMER_NAME: 'coolchat_customer_name',
    CUSTOMER_EMAIL: 'coolchat_customer_email',
  } as const;
  
export const DEFAULT_CHAT_MODE: ChatMode = 'AI';
export const PREVIEW_CHAT_MODE: ChatMode = 'AI_ONLY';