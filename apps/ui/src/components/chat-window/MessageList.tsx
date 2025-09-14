// import React, { useEffect, useRef } from "react";
// import MessageBubble from "./MessageBubble";
// import TypingIndicator from "./TypingIndicator";

// export interface Message {
//   id: string;
//   content: string;
//   type: "sent" | "received";
//   timestamp?: string;
// }

// interface MessageListProps {
//   messages: Message[];
//   isTyping?: boolean;
//   botAvatar?: string;
//   botName?: string;
// }

// const MessageList: React.FC<MessageListProps> = ({
//   messages,
//   isTyping = false,
//   botAvatar,
//   botName,
// }) => {
//   const bottomRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages, isTyping]);

//   return (
//     <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 bg-white">
//       {messages.map((msg) => (
//         <MessageBubble
//           key={msg.id}
//           content={msg.content}
//           type={msg.type}
//           timestamp={msg.timestamp}
//           avatarUrl={msg.type === "received" ? botAvatar : undefined}
//         />
//       ))}

//       {isTyping && (
//         <TypingIndicator avatarUrl={botAvatar} displayName={botName} />
//       )}

//       <div ref={bottomRef} />
//     </div>
//   );
// };

// export default MessageList;

import React, { type RefObject } from 'react';
import { motion } from 'framer-motion';

interface Message {
  id: string;
  content: string;
  sender_type: string;
  timestamp: string;
  isUser: boolean;
}

interface Props {
  messages: Message[];
  streamingMessage: string;
  isStreaming: boolean;
  showAiInitializing: boolean;
  showTypingIndicator: boolean;
  typingUser: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  isConnecting: boolean;
  hasError: boolean;
  error: string | null;
}

export const MessageList: React.FC<Props> = ({
  messages,
  streamingMessage,
  isStreaming,
  showAiInitializing,
  showTypingIndicator,
  typingUser,
  messagesEndRef,
  isConnecting,
  hasError,
  error
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {isConnecting && (
        <div className="flex items-center justify-center py-4">
          <motion.div
            className="h-6 w-6 border-2 border-blue-300 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          />
          <motion.span
            className="ml-2 text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            Đang kết nối...
          </motion.span>
        </div>
      )}

      {hasError && (
        <div className="text-center py-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-xs px-4 py-2 rounded-lg ${
              message.isUser
                ? 'bg-blue-500 text-white'
                : message.sender_type === 'SYSTEM'
                ? 'bg-gray-100 text-gray-700 text-sm'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {message.content}
          </div>
        </div>
      ))}

      {isStreaming && streamingMessage && (
        <div className="flex justify-start">
          <div className="max-w-xs px-4 py-2 rounded-lg bg-gray-100 text-gray-800">
            {streamingMessage}
            <span className="animate-pulse">|</span>
          </div>
        </div>
      )}

      {showAiInitializing && (
        <div className="flex justify-center py-2">
          <div className="text-sm text-gray-500 italic">AI đang khởi tạo...</div>
        </div>
      )}

      {showTypingIndicator && (
        <div className="flex justify-start">
          <div className="max-w-xs px-4 py-2 rounded-lg bg-gray-100 text-gray-800">
            <span className="text-sm">{typingUser} đang nhập...</span>
            <div className="flex space-x-1 mt-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
