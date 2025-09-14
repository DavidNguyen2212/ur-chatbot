// import React, { useState, type KeyboardEvent } from "react";

// interface ChatInputProps {
//   onSend: (message: string) => void;
//   disabled?: boolean;
//   placeholder?: string;
//   primaryColor: string;
// }

// const ChatInput: React.FC<ChatInputProps> = ({
//   onSend,
//   disabled = false,
//   placeholder = "Nhập tin nhắn...",
//   primaryColor,
// }) => {
//   const [value, setValue] = useState("");

//   const handleSend = () => {
//     const trimmed = value.trim();
//     if (trimmed) {
//       onSend(trimmed);
//       setValue("");
//     }
//   };

//   const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       handleSend();
//     }
//   };

//   return (
//     <div className="flex items-center gap-2 px-4 py-2 border-t">
//       <input
//         type="text"
//         value={value}
//         onChange={(e) => setValue(e.target.value)}
//         onKeyPress={handleKeyPress}
//         disabled={disabled}
//         placeholder={placeholder}
//         className="flex-1 rounded-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2"
//       />
//       <button
//         onClick={handleSend}
//         disabled={disabled || !value.trim()}
//         className="px-4 py-2 rounded-full text-white transition-colors disabled:opacity-50"
//         style={{ backgroundColor: primaryColor }}
//       >
//         Gửi
//       </button>
//     </div>
//   );
// };

// export default ChatInput;

import React from 'react';
import { MessageCircle } from 'lucide-react';

interface Props {
  inputValue: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export const InputBox: React.FC<Props> = ({
  inputValue,
  onInputChange,
  onKeyPress,
  onSend,
  isConnected,
  isConnecting,
  inputRef
}) => {
  return (
    <div className="p-4 border-t">
      <div className="flex space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onKeyPress}
          placeholder="Nhập tin nhắn..."
          disabled={!isConnected || isConnecting}
          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={onSend}
          disabled={!isConnected || !inputValue.trim() || isConnecting}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
