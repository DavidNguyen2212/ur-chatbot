import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useChatConnection } from '../../hooks/useChatConnection';
import type { CustomerInfo } from '../../types/widget.types';
import { ChatHeader } from './ChatHeader';
import { InputBox } from './ChatInput';
import { UserInfoPopup } from './UserInfoPopup';
import { MessageList } from './MessageList';
import { AnimatePresence, motion } from "framer-motion";

// Types
interface ChatConfig {
  organization_id: string;
  displayName?: string;
  primaryColor?: string;
  avatar?: string;
}

interface Message {
  id: string;
  content: string;
  sender_type: string | 'CUSTOMER' | 'AGENT' | 'AI' | 'SYSTEM';
  timestamp: string;
  isUser: boolean;
}

interface ChatWindowProps {
  config: ChatConfig;
  baseUrl: string;
  onClose: () => void;
  isPreview?: boolean;
  show: boolean;
  token: string
}

// Generate session ID
const generateSessionId = (): string => {
  const existing = localStorage.getItem('coolchat_session_id');
  if (existing) return existing;
  
  const sessionId = 'session_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('coolchat_session_id', sessionId);
  return sessionId;
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  config, 
  baseUrl, 
  onClose, 
  isPreview = false, 
  show,
  token 
}) => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [userInfo, setUserInfo] = useState<CustomerInfo>({ name: '', email: '' });
  const [sessionId] = useState(() => generateSessionId());
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showAiInitializing, setShowAiInitializing] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [typingUser, setTypingUser] = useState('');

  // Local storage for customer info
  const [customerName, setCustomerName] = useLocalStorage('coolchat_customer_name', '');
  const [customerEmail, setCustomerEmail] = useLocalStorage('coolchat_customer_email', '');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize chat mode based on preview
  const initialChatMode = isPreview ? 'AI_ONLY' : 'AI';
  
  // Chat connection hook
  const {
    messages: connectionMessages,
    typingUsers,
    customerInfo,
    chatMode,
    sendMessage,
    sendTypingStatus,
    switchMode,
    updateCustomerInfo,
    setChatMode,
    isConnected,
    isConnecting,
    hasError,
    error
  } = useChatConnection({
    baseUrl,
    config,
    sessionId,
    autoConnect: true,
    dataToken: token
  });


  // Initialize customer info from localStorage
  useEffect(() => {
    if (customerName || customerEmail) {
      updateCustomerInfo(customerName, customerEmail);
      setUserInfo({ name: customerName, email: customerEmail })
    }
  }, [customerName, customerEmail, updateCustomerInfo])

  // Set initial chat mode
  useEffect(() => {
    setChatMode(initialChatMode);
  }, [initialChatMode, setChatMode]);

  // Convert connection messages to display format
  useEffect(() => {
    const displayMessages = connectionMessages.map((msg, index) => ({
      id: `${index}-${msg.timestamp}`,
      content: msg.content || '',
      sender_type: msg.type === 'message' ? 'AI' : 'SYSTEM',
      timestamp: msg.timestamp || new Date().toISOString(),
      isUser: msg.customer_name === customerInfo.name && msg.type === 'message'
    }));
    
    setMessages(displayMessages);
  }, [connectionMessages, customerInfo.name]);

  // Handle typing indicator
  useEffect(() => {
    if (typingUsers.length > 0) {
      setShowTypingIndicator(true);
      setTypingUser(typingUsers[0]);
    } else {
      setShowTypingIndicator(false);
      setTypingUser('');
    }
  }, [typingUsers]);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, showTypingIndicator]);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.matchMedia("(max-width: 480px)").matches;
      if (isMobile) {
        document.body.classList.add("coolchat-mobile-mode");
      } else {
        document.body.classList.remove("coolchat-mobile-mode");
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle mobile body class when showing/hiding
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 480px)").matches;
    if (isMobile) {
      if (show) {
        document.body.classList.add("coolchat-widget-open");
      } else {
        document.body.classList.remove("coolchat-widget-open");
      }
    }
  }, [show]);

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || !isConnected) return;

    const success = sendMessage(inputValue.trim());
    if (success) {
      setInputValue('');
      // Stop typing indicator
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
      sendTypingStatus(false);
      setIsTyping(false);
    }
  }, [inputValue, isConnected, sendMessage, sendTypingStatus, typingTimeout]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true);
      sendTypingStatus(true);
    }

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      setIsTyping(false);
      sendTypingStatus(false);
    }, 1000);
    
    setTypingTimeout(timeout);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleSwitchMode = () => {
    if (chatMode === 'AI_ONLY') {
      // Show message that human chat is not available
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        content: 'Trò chuyện với nhân viên hỗ trợ không khả dụng trong chế độ này.',
        sender_type: 'SYSTEM',
        timestamp: new Date().toISOString(),
        isUser: false
      };
      setMessages(prev => [...prev, systemMessage]);
      return;
    }

    if (chatMode === 'HUMAN') {
      // Switch back to AI
      switchMode('AI');
      return;
    }

    // Switch to human - show user info modal
    setShowUserInfoModal(true);
  };

  const handleUserInfoSubmit = () => {
    setCustomerName(userInfo.name);
    setCustomerEmail(userInfo.email);
    updateCustomerInfo(userInfo.name, userInfo.email);
    switchMode('HUMAN');
    setShowUserInfoModal(false);
  };

  const isModeDisabled = () => chatMode === 'AI_ONLY';

  return (
    <AnimatePresence>
      {/* Chat Window */}
      {show && (
      <motion.div 
        className={`fixed bottom-4 right-4 w-80 h-96 bg-white rounded-lg shadow-2xl flex flex-col z-50 md:w-80 md:h-96 ${
          window.matchMedia("(max-width: 480px)").matches 
            ? 'fixed inset-0 w-full h-full rounded-none' 
            : ''
        }`}
        style={{ 
          borderTop: `4px solid ${config.primaryColor || '#3B82F6'}`,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
      >
        <ChatHeader
          displayName={config.displayName}
          avatar={config.avatar}
          primaryColor={config.primaryColor}
          chatMode={chatMode}
          onClose={onClose}
          onSwitchMode={handleSwitchMode}
          isModeDisabled={isModeDisabled()}
        />

        {/* Messages */}
        <MessageList
          messages={messages}
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
          showAiInitializing={showAiInitializing}
          showTypingIndicator={showTypingIndicator}
          typingUser={typingUser}
          messagesEndRef={messagesEndRef}
          isConnecting={isConnecting}
          hasError={hasError}
          error={error}
        />

        {/* Input */}
        <InputBox
          inputValue={inputValue}
          onInputChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onSend={handleSendMessage}
          isConnected={isConnected}
          isConnecting={isConnecting}
          inputRef={inputRef}
        />

        {/* User Info Modal */}
        {showUserInfoModal && (
          <UserInfoPopup
          name={userInfo.name}
          email={userInfo.email}
          onChangeName={(name) => setUserInfo((prev) => ({ ...prev, name }))}
          onChangeEmail={(email) => setUserInfo((prev) => ({ ...prev, email }))}
          onCancel={() => setShowUserInfoModal(false)}
          onSubmit={handleUserInfoSubmit}
        />
        )}
      </motion.div>
      )}
    </AnimatePresence>
  );
}
