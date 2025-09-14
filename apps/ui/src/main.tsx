// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.tsx'

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )

import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Tailwind CSS

// Prevent multiple initialization
if (!window.coolchatWidget) {
  const container = document.getElementById('coolchat-widget-container') || 
    (() => {
      const div = document.createElement('div');
      div.id = 'coolchat-widget-container';
      document.body.appendChild(div);
      return div;
    })();

  const root = ReactDOM.createRoot(container);
  root.render(<App />);
  
  window.coolchatWidget = true; // Mark as initialized
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    coolchatWidget?: boolean;
  }
}