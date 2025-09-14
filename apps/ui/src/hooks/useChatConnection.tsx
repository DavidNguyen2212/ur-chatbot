// ok
import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { CustomerInfo } from '../types/widget.types';
import { useLocalStorage } from './useLocalStorage';

// Types
interface ChatConfig {
  organization_id: string;
}

interface MessageData {
  type: string;
  content?: string;
  customer_name?: string;
  customer_email?: string;
  mode?: string;
  is_typing?: boolean;
  name?: string;
  timestamp?: string;
  [key: string]: any;
}


interface UseChatConnectionOptions {
  baseUrl: string;
  config: ChatConfig;
  sessionId: string;
  autoConnect?: boolean;
  dataToken: string;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  error: string | null;
}


export const useChatConnection = (options: UseChatConnectionOptions) => {
  const { baseUrl, config, sessionId, autoConnect = false, dataToken } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    error: null
  });

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    email: ''
  });

  // Use localStorage hook for chat mode
  const [chatMode, setChatMode] = useLocalStorage<string>('coolchat_mode', 'AI');

  // Refs
  const socketRef = useRef<Socket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3000;

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [])

  // Connect function
  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }

    clearReconnectTimeout()

    // Create socket path
    // const orgId = config.organization_id;
    // const socketPath = `/ws/chat/customer/${orgId}/${sessionId}/`;
    const namespace = '/chat/customer';

    // Optional: nếu bạn có JWT
    // const token = localStorage.getItem('coolchat_token'); 
    console.log("Connecting to Socket.IO:", namespace);

    setConnectionState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }))

    socketRef.current = io(baseUrl + namespace, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      timeout: 10000,
      query: {
        orgId: config.organization_id,
        sessionId,
        token: dataToken,
      }
    })

    const socket = socketRef.current;

    // Connection established
    socket.on('connect', () => {
      console.log("Socket.IO connection established");
      reconnectAttemptsRef.current = 0;
      setConnectionState({
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        error: null
      });

      const mode = chatMode
      // Only fetch history if not in AI_ONLY mode
      if (mode !== "AI_ONLY") {
        socket.emit('message', {
          type: "fetch_history"
        });
      }

      if (mode === "HUMAN") {
        socket.emit('message', {
          type: "request_human",
          customer_name: customerInfo.name || "",
          customer_email: customerInfo.email || ""
        });
      } else if (mode === "AI_ONLY") {
        socket.emit('message', {
          type: "set_mode",
          mode: "AI_ONLY"
        });
      }
    })

    // Handle incoming messages
    socket.on('message', (data: MessageData) => {
      console.log("Socket.IO message received:", data);

      if (data.type === 'typing') {
        setTypingUsers(prev => {
          const userName = data.name || 'Unknown'
          if (data.is_typing) {
            return prev.includes(userName) ? prev : [...prev, userName]
          } else {
            return prev.filter(name => name !== userName);
          }
        })
      } else if (data.type === 'message' || data.type === 'history') {
          setMessages(prev => {
            // Handle history vs single message
            if (data.type === 'history' && Array.isArray(data.messages)) {
              return data.messages;
            } else {
              return [...prev, { ...data, timestamp: new Date().toISOString() }];
            }
          });
      }
    })

    // Handle connection errors
    socket.on('connect_error', (error: Error) => {
      console.error("Socket.IO connection error:", error);
      setConnectionState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message
      }));
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      console.log("Socket.IO connection disconnected:", reason);
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false
      }));
      
      // Attempt to reconnect if it wasn't disconnected intentionally
      if (reason !== 'io client disconnect' && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const backoff = Math.min(
          reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current - 1), 
          30000
        );  
        console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${backoff/1000}s`);

        setConnectionState(prev => ({
          ...prev,
          reconnectAttempts: reconnectAttemptsRef.current,
          isConnecting: true
        }));

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoff);
      }
    })

    // Start the connection
    socket.connect();
  }, [baseUrl, config.organization_id, sessionId, customerInfo.name, customerInfo.email, clearReconnectTimeout]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setConnectionState({
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      error: null
    });
  }, [clearReconnectTimeout])

  // Send message function
  const sendMessage = useCallback((content: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('message', {
        type: "message",
        content: content,
        customer_name: customerInfo.name || "",
        customer_email: customerInfo.email || ""
      })

      return true
    }
    return false
  }, [customerInfo.name, customerInfo.email])

  // Send typing status
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('message', {
        type: "typing",
        is_typing: isTyping,
        name: customerInfo.name || "Customer"
      });
      return true;
    }
    return false;
  }, [customerInfo.name]);

  // Switch mode function
  const switchMode = useCallback((mode: string) => {
    if (socketRef.current && socketRef.current.connected) {
      if (mode === 'HUMAN') {
        socketRef.current.emit('message', {
          type: "request_human",
          customer_name: customerInfo.name || "",
          customer_email: customerInfo.email || ""
        })
      } else if (mode === 'AI') {
        socketRef.current.emit('message', {
          type: "end_conversation"
        });
      }
    }

    setChatMode(mode);
    return true;
  }, [customerInfo.name, customerInfo.email, setChatMode])


  // Update customer info
  const updateCustomerInfo = useCallback((name: string, email: string) => {
    setCustomerInfo({ name, email });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Auto connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [clearReconnectTimeout]);

  return {
    // State
    connectionState,
    messages,
    typingUsers,
    customerInfo,
    chatMode,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    sendTypingStatus,
    switchMode,
    updateCustomerInfo,
    clearMessages,
    setChatMode,
    
    // Computed
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    hasError: !!connectionState.error,
    error: connectionState.error
  };
}

// Usage example
// Usage Example Component
// export const ChatExample = () => {
//   const chat = useChatConnection({
//     baseUrl: 'https://your-server.com',
//     config: { organization_id: 'your-org-id' },
//     sessionId: 'session-123',
//     autoConnect: true
//   });

//   const [messageInput, setMessageInput] = useState('');
//   const [isTyping, setIsTyping] = useState(false);

//   const handleSendMessage = () => {
//     if (messageInput.trim()) {
//       chat.sendMessage(messageInput);
//       setMessageInput('');
//     }
//   };

//   const handleTyping = (typing: boolean) => {
//     if (typing !== isTyping) {
//       setIsTyping(typing);
//       chat.sendTypingStatus(typing);
//     }
//   };

//   return (
//     <div className="p-4 max-w-md mx-auto">
//       <div className="mb-4">
//         <div className="flex items-center gap-2 mb-2">
//           <span className={`w-3 h-3 rounded-full ${
//             chat.isConnected ? 'bg-green-500' : 
//             chat.isConnecting ? 'bg-yellow-500' : 'bg-red-500'
//           }`}></span>
//           <span className="text-sm">
//             {chat.isConnected ? 'Connected' : 
//              chat.isConnecting ? 'Connecting...' : 'Disconnected'}
//           </span>
//         </div>
        
//         {chat.hasError && (
//           <div className="text-red-500 text-sm mb-2">
//             Error: {chat.error}
//           </div>
//         )}
        
//         <div className="flex gap-2">
//           <button 
//             onClick={chat.connect}
//             disabled={chat.isConnected || chat.isConnecting}
//             className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
//           >
//             Connect
//           </button>
//           <button 
//             onClick={chat.disconnect}
//             disabled={!chat.isConnected}
//             className="px-3 py-1 bg-red-500 text-white rounded disabled:opacity-50"
//           >
//             Disconnect
//           </button>
//         </div>
//       </div>

//       <div className="border rounded p-2 h-64 overflow-y-auto mb-4">
//         {chat.messages.map((msg, index) => (
//           <div key={index} className="mb-2">
//             <div className="text-sm text-gray-500">
//               {msg.customer_name || 'System'} - {msg.timestamp}
//             </div>
//             <div>{msg.content}</div>
//           </div>
//         ))}
        
//         {chat.typingUsers.length > 0 && (
//           <div className="text-sm text-gray-500 italic">
//             {chat.typingUsers.join(', ')} is typing...
//           </div>
//         )}
//       </div>

//       <div className="flex gap-2">
//         <input
//           type="text"
//           value={messageInput}
//           onChange={(e) => setMessageInput(e.target.value)}
//           onFocus={() => handleTyping(true)}
//           onBlur={() => handleTyping(false)}
//           onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
//           placeholder="Type a message..."
//           className="flex-1 px-3 py-2 border rounded"
//         />
//         <button
//           onClick={handleSendMessage}
//           disabled={!chat.isConnected || !messageInput.trim()}
//           className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
//         >
//           Send
//         </button>
//       </div>
//     </div>
//   );
// };