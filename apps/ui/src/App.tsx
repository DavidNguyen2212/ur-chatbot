import React from 'react';
import { CoolChatWidget } from './components/widget';
import type { WidgetProps } from './components/widget/CoolChatWidget';

// Lấy props từ script tag hoặc window object
const getWidgetProps = (): WidgetProps => {
  // Có thể lấy từ script tag attributes hoặc window object
  const scriptElement = document.querySelector('script[data-token]');
  
  if (scriptElement) {
    return {
      token: scriptElement.getAttribute('data-token') || "",
      baseUrl: scriptElement.getAttribute('data-base-url') || "",
      previewConfig: scriptElement.getAttribute('data-config') || undefined,
      isPreview: scriptElement.getAttribute('data-preview') === 'true',
      isOpen: scriptElement.getAttribute('data-open') === 'true',
    };
  }

  // Fallback hoặc props mặc định
  return {
    baseUrl: "http://localhost:4001",
    token: "9b976ae5-c2a1-4107-ab1b-248f5ec7f8c5"
  };
};

const App: React.FC = () => {
  // const widgetProps = getWidgetProps();
  console.log("hihi");
  const widgetProps: WidgetProps = {
    token: "9b976ae5-c2a1-4107-ab1b-248f5ec7f8c5",
    baseUrl: "http://localhost:4001",
    isPreview: true,
    isOpen: true,
  };

  return (
    <div className="app">
      <CoolChatWidget {...widgetProps} />
    </div>
  );
};

export default App;