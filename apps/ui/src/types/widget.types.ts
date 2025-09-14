export interface WidgetConfig {
    organization_id?: string;
    avatar?: string;
    title?: string;
    background_image?: string; 
    primary_background_color: string;
    display_name: string;
    secondary_background_color: string;
    primary_font_color: string;
    font: string;
    description?: string;
    border_radius: number;
    message_border_radius: number;
    font_size: string;
    sending_message_font_color: string;
    receiving_message_background_color: string;
    sending_message_background_color: string;
    receiving_message_font_color: string;

//     features?: {
//       file_upload?: boolean;
//       typing_indicator?: boolean;
//       read_receipts?: boolean;
//     };
}

export interface CustomerMessage {
    id: string;
    session_id: string;
    content: string;
    customer_name?: string;
    customer_email?: string;
    created_at: string;
    message_type: 'customer' | 'agent' | 'bot';
    // Add other message properties
}
  
export interface SendMessagePayload {
    session_id: string;
    content: string;
    customer_name?: string;
    customer_email?: string;
    organization_id?: string;
}
  
export interface SendMessageResponse {
    id: string;
    session_id: string;
    content: string;
    created_at: string;
    status: 'sent' | 'delivered' | 'failed';
    // Add other response properties
}

export interface CustomerInfo {
    name: string;
    email: string;
}



export type ChatMode = 'AI' | 'AI_ONLY';