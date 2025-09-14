// ok
import React, { useState, useEffect, useCallback } from 'react';
import { ChatbotAPI, createChatbotAPI } from '../../api/api';
import { WidgetButton } from './WidgetButton';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useViewportMeta } from '../../hooks/useViewportMeta';
import { STORAGE_KEYS, DEFAULT_CHAT_MODE, PREVIEW_CHAT_MODE } from '../../utils/constant'
import type { WidgetConfig, ChatMode } from '../../types/widget.types';
import { ChatWindow } from '../chat-window';

export interface WidgetProps {
  token: string;
  baseUrl: string;
  previewConfig?: string;
  isPreview?: boolean;
  isOpen?: boolean;
}

export const CoolChatWidget: React.FC<WidgetProps> = ({
  token,
  baseUrl,
  previewConfig,
  isPreview = false,
  isOpen: initialIsOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [api, setApi] = useState<ChatbotAPI | null>(createChatbotAPI(baseUrl, token!));
  // const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({ name: '', email: '' });
  const [customerName, setCustomerName] = useLocalStorage('coolchat_customer_name', '');
  const [customerEmail, setCustomerEmail] = useLocalStorage('coolchat_customer_email', '');

  const [chatMode, setChatMode] = useLocalStorage<ChatMode>(
    STORAGE_KEYS.CHAT_MODE,
    DEFAULT_CHAT_MODE
  );


  // Ensure viewport meta for responsive design
  useViewportMeta();

  // Initialize API
  useEffect(() => {
    if (baseUrl && token) {
      setApi(new ChatbotAPI(baseUrl, token));
    }
  }, [baseUrl, token]);

  // Set initial mode based on preview flag
  useEffect(() => {
    if (isPreview) {
      setChatMode(PREVIEW_CHAT_MODE);
    } else if (!chatMode || chatMode === 'AI_ONLY') {
      setChatMode(DEFAULT_CHAT_MODE);
    }
  }, [isPreview, chatMode, setChatMode]);

  // Load configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        let widgetConfig: WidgetConfig;
        
        if (previewConfig) {
          widgetConfig = JSON.parse(previewConfig);
        } else if (api) {
          widgetConfig = await api.fetchConfig();
          console.log("Config: ", widgetConfig);
        } else {
          throw new Error('No API or preview config available');
        }

        if (!widgetConfig) {
          throw new Error('Failed to load widget configuration');
        }

        setConfig(widgetConfig);

        // Set organization ID for API calls
        if (widgetConfig.organization_id && api) {
          api.setOrganizationId(widgetConfig.organization_id);
        }
      } catch (error) {
        console.error('CoolChat Widget Error:', error);
      }
    };

    loadConfig();
  }, [api, previewConfig]);

  // Set up customer info
  useEffect(() => {
    if (customerName) {
      // setCustomerInfo({ name: customerName, email: customerEmail });
      setCustomerName(customerName)
    }
    if (customerEmail) {
      setCustomerEmail(customerEmail)
    }
  }, [customerName, customerEmail]);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  if (!config) {
    return null; // or loading spinner
  }

  return (
    <div 
      id="coolchat-widget-container"
      className="fixed bottom-4 right-4 z-50"
    >
      <ChatWindow
        config={
          {
            organization_id: config.organization_id || "",
            avatar: config.avatar,
            primaryColor: config.primary_font_color,
            displayName: config.display_name
          }
        }
        baseUrl={baseUrl}
        onClose={toggleChat}
        isPreview={isPreview}
        show={isOpen}
        token={token}
      />
      <WidgetButton
        config={
          {
            avatar_url: config.avatar,
            display_name: config.display_name,
            primary_background_color: config.primary_background_color,
            secondary_background_color: config.secondary_background_color
          }
        }
        baseUrl={baseUrl}
        isVisible={!isOpen}
        onToggle={toggleChat}
      />
    </div>
  );
};