// ok
import React, { useState, useCallback } from "react";

interface WidgetButtonConfig {
  avatar_url?: string;
  display_name?: string;
  primary_background_color: string;
  secondary_background_color: string;
}

interface WidgetButtonProps {
  config: WidgetButtonConfig;
  baseUrl: string;
  isVisible: boolean;
  onToggle: () => void;
}

export const WidgetButton: React.FC<WidgetButtonProps> = ({
  config,
  baseUrl,
  isVisible,
  onToggle,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const avatarUrl =
    config.avatar_url || `${baseUrl}/static/images/default-avatar.png`;

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleImageError = useCallback(() => {
    if (!imageError) {
      setImageError(true);
    }
  }, [imageError]);

  // Use state-based styling instead of direct DOM manipulation
  const buttonStyle = {
    backgroundColor: isHovered 
      ? config.primary_background_color 
      : config.secondary_background_color,
  };

  const finalAvatarUrl = imageError 
    ? `${baseUrl}/static/images/default-avatar.png`
    : avatarUrl;

  return (
    <button
      onClick={onToggle}
      aria-label={`Open chat with ${config.display_name || 'chatbot'}`}
      className={`
        fixed bottom-6 right-6 z-50 
        w-14 h-14 rounded-full 
        shadow-lg hover:shadow-xl
        overflow-hidden 
        transition-all duration-300 ease-in-out
        border-0 p-0 cursor-pointer
        transform hover:scale-105 active:scale-95
        ${isVisible ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}
      `}
      style={buttonStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={!isVisible}
    >
      <img
        src={finalAvatarUrl}
        alt={config.display_name || "Chatbot Avatar"}
        className="w-full h-full object-cover"
        onError={handleImageError}
        loading="lazy"
      />
    </button>
  );
};