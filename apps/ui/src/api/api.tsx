// ok
import axios, { type AxiosInstance } from 'axios'
import type { CustomerMessage, SendMessagePayload, SendMessageResponse } from '../types/widget.types';


export class ChatbotAPI {
    private client: AxiosInstance;
    private token: string;
    private organizationId?: string

    constructor(baseUrl: string, token: string) {
        this.token = token
        this.client = axios.create({
            baseURL: baseUrl,
            withCredentials: true,
            timeout: 10000,
            headers: {
                "Content-Type": "application/json",
            }
        })
    }

    setOrganizationId(id: string) {
        this.organizationId = id;
    }

    async fetchConfig(): Promise<any | null> {
        try {
            const res = await this.client.get(`/chat/chatbot/widget-config/${this.token}/`);
            return res.data;
        } catch (err) {
            console.error("Failed to fetch widget configuration:", err);
            return null;
        }
    }

    async sendCustomerMessage(
        sessionId: string,
        content: string,
        customerName = "",
        customerEmail = ""
    ): Promise<SendMessageResponse | null> {
        try {
            const payload: SendMessagePayload = {
                session_id: sessionId,
                content: content.trim(),
                customer_name: customerName,
                customer_email: customerEmail,
                organization_id: this.organizationId,
            };
        
            const res = await this.client.post('/chat/customer-message', payload)
            return res.data
        } catch (err) {
            console.error("Failed to send customer message:", err);
            return null;
        }
    }

    async getConversationMessages(sessionId: string): Promise<CustomerMessage[]> {
        try {
            const res = await this.client.get("/chat/customer-messages/", {
                params: { session_id: sessionId },
            });
            return res.data;
        } catch (err) {
            console.error("Failed to fetch conversation messages:", err);
            return [];
        }
    }

    // Method to handle file uploads if needed
  async uploadFile(file: File, sessionId: string): Promise<{ url: string; id: string } | null> {
    if (!file || !sessionId) {
      throw new Error('File and session ID are required');
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);
      
      if (this.organizationId) {
        formData.append('organization_id', this.organizationId);
      }

      const response = await this.client.post<{ url: string; id: string }>(
        '/chat/upload-file',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to upload file:', error);
      return null;
    }
  }

  // Clean up method
  destroy(): void {
    // Cancel any pending requests
    this.client.defaults.timeout = 1;
  }
}

// Factory function for easier testing
export const createChatbotAPI = (baseUrl: string, token: string): ChatbotAPI => {
    return new ChatbotAPI(baseUrl, token);
};