import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip } from 'lucide-react';

interface MessageInputConfig {
  primary_font_color?: string;
}

interface MessageInputProps {
  config?: MessageInputConfig;
  onSend: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  config = {},
  onSend,
  onTyping,
  disabled = false
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const handleTyping = (typing: boolean) => {
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    onTyping?.(typing);

    if (typing) {
      typingTimeoutRef.current = window.setTimeout(() => {
        onTyping?.(false);
      }, 3000);
    }
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSend(trimmedMessage);
      setMessage('');
      handleTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (onTyping) {
      handleTyping(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (onTyping) {
      handleTyping(true);
    }
  };

  const handleBlur = () => {
    if (onTyping) {
      handleTyping(false);
    }
  };

  const handleAttachment = () => {
    console.log('File attachment clicked');
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex items-end gap-2 p-4 bg-white border-t border-gray-200">
      {/* Attach Button - Hidden by default */}
      <button
        type="button"
        onClick={handleAttachment}
        disabled={disabled}
        className="hidden p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Đính kèm tệp"
      >
        <Paperclip 
          size={20} 
          className="text-gray-600"
          style={{ color: config.primary_font_color }}
        />
      </button>

      {/* Textarea */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={disabled ? "Vui lòng chờ..." : "Nhập tin nhắn của bạn..."}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          rows={1}
          style={{ 
            minHeight: '40px',
            maxHeight: '120px',
            overflow: 'auto'
          }}
        />
      </div>

      {/* Send Button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        <span className="text-sm font-medium">Gửi</span>
        <Send 
          size={14} 
          style={{ color: config.primary_font_color || 'white' }}
        />
      </button>
    </div>
  );
};

export default MessageInput;