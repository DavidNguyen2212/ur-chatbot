import React, { useState, useEffect, useRef } from 'react';
import { StatusIndicator } from '../chat-ui/StatusIndicator';
import TypingIndicator from '../chat-ui/TypingIndicator';

interface Message {
  content: string;
  sender_type: 'CUSTOMER' | 'AI';
  id?: string;
}

interface MessageDisplayProps {
  messages: Message[];
  isTyping?: boolean;
  typingUser?: string;
  typingAvatar?: string;
  isConnecting?: boolean;
  isAiInitializing?: boolean;
  streamingMessage?: string;
  isStreaming?: boolean;
  systemAvatar?: string;
}

export const MessageDisplay: React.FC<MessageDisplayProps> = ({
  messages = [],
  isTyping = false,
  typingUser,
  typingAvatar,
  isConnecting = false,
  isAiInitializing = false,
  streamingMessage = '',
  isStreaming = false,
  systemAvatar
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isConnecting, isAiInitializing, streamingMessage]);


  const MessageBubble = ({ message, isStreaming = false }: { message: Message, isStreaming?: boolean }) => {
    const isSent = message.sender_type === 'CUSTOMER';
    
    return (
      <div
        className={`rounded-lg p-2 my-1 max-w-[80%] ${
          isSent 
            ? 'bg-blue-500 text-white self-end' 
            : 'bg-gray-100 text-gray-900 self-start'
        } ${isStreaming ? 'animate-pulse' : ''}`}
        data-sender-type={message.sender_type}
      >
        <div 
          dangerouslySetInnerHTML={{ 
            __html: message.content.replace(/\n/g, '<br>') 
          }} 
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-1">
      {/* Render message history */}
      {messages.map((message, index) => (
        <MessageBubble 
          key={message.id || index} 
          message={message} 
        />
      ))}

      {/* Render streaming message */}
      {isStreaming && streamingMessage && (
        <MessageBubble 
          message={{ 
            content: streamingMessage, 
            sender_type: 'AI' 
          }} 
          isStreaming={true}
        />
      )}

      {/* Status indicators */}
      {isConnecting && (
        <StatusIndicator 
          message="Đang kết nối..." 
          avatarUrl={systemAvatar}
        />
      )}
      {isAiInitializing && (
        <StatusIndicator 
          message="Đang khởi chạy AI..." 
          avatarUrl={systemAvatar}
        />
      )}
      {isTyping && (
        <TypingIndicator 
          displayName={typingUser || "Hệ thống"}
          avatarUrl={typingAvatar || systemAvatar}
        />
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
};

// Hook để sử dụng với streaming messages
export const useMessageDisplay = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const startMessageStream = () => {
    setIsStreaming(true);
    setStreamingMessage('');
  };

  const appendMessageChunk = (chunk: string) => {
    setStreamingMessage(prev => prev + chunk);
  };

  const finishMessageStream = () => {
    if (streamingMessage) {
      addMessage({
        content: streamingMessage,
        sender_type: 'AI',
        id: Date.now().toString()
      });
    }
    setStreamingMessage('');
    setIsStreaming(false);
  };

  const clearMessages = () => {
    setMessages([]);
    setStreamingMessage('');
    setIsStreaming(false);
  };

  const setMessageHistory = (messageHistory: Message[]) => {
    setMessages(messageHistory);
  };

  return {
    messages,
    streamingMessage,
    isStreaming,
    addMessage,
    startMessageStream,
    appendMessageChunk,
    finishMessageStream,
    clearMessages,
    setMessageHistory
  };
};
