import { Bot, Headphones, User, X } from "lucide-react";
import React from "react";

interface ChatHeaderProps {
  displayName?: string;
  avatar?: string;
  primaryColor?: string;
  chatMode: string;
  onClose: () => void;
  onSwitchMode: () => void;
  isModeDisabled: boolean;
}


export const ChatHeader: React.FC<ChatHeaderProps> = ({
  avatar,
  displayName,
  primaryColor = '#3B82F6',
  onClose,
  chatMode,
  onSwitchMode,
  isModeDisabled
}) => {
  const getModeIcon = () => {
    switch (chatMode) {
      case 'HUMAN':
        return <User className="w-5 h-5" />;
      case 'AI_ONLY':
        return <Bot className="w-5 h-5 opacity-50" />;
      default:
        return <Headphones className="w-5 h-5" />;
    }
  };

  const getModeTitle = () => {
    switch (chatMode) {
      case 'HUMAN':
        return 'Switch to AI';
      case 'AI_ONLY':
        return 'Trò chuyện với nhân viên không khả dụng trong chế độ này';
      default:
        return 'Get Human Help';
    }
  };


  return (
    <div 
      className="flex items-center justify-between p-4 text-white rounded-t-lg"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex items-center space-x-3">
        {avatar && (
          <img 
            src={avatar} 
            alt="Avatar" 
            className="w-8 h-8 rounded-full"
          />
        )}
        <h3 className="font-medium">{displayName || 'Chat Support'}</h3>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={onSwitchMode}
          disabled={isModeDisabled}
          title={getModeTitle()}
          className={`p-2 rounded-full transition-colors ${
            isModeDisabled
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-black hover:bg-opacity-20'
          }`}
        >
          {getModeIcon()}
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-black hover:bg-opacity-20 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

