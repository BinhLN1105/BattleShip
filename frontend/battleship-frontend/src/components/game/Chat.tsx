/**
 * Chat Component - Giao diện chat real-time
 */

import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { ChatMessage } from '../../types/game';

interface ChatProps {
  className?: string;
}

export const Chat: React.FC<ChatProps> = ({ className = '' }) => {
  const { state, actions } = useGame();
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom when new messages arrive (chỉ khi nhận từ đối thủ)
  useEffect(() => {
    if (state.chatMessages.length === 0) return;
    const lastMsg = state.chatMessages[state.chatMessages.length - 1];
    if (lastMsg.sender !== state.playerName) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.chatMessages, state.playerName]);

  // Handle message send
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      actions.sendChatMessage(message.trim());
      setMessage('');
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Get message style based on sender
  const getMessageStyle = (msg: ChatMessage) => {
    const isMyMessage = msg.sender === state.playerName;
    return {
      container: `flex ${isMyMessage ? 'justify-end' : 'justify-start'} mb-2`,
      bubble: `max-w-xs px-3 py-2 rounded-lg ${
        isMyMessage 
          ? 'bg-blue-600 text-white ml-auto' 
          : 'bg-gray-200 text-gray-800 mr-auto'
      }`,
      sender: `text-xs ${isMyMessage ? 'text-blue-200' : 'text-gray-500'} mb-1`,
      time: `text-xs ${isMyMessage ? 'text-blue-200' : 'text-gray-400'} mt-1`
    };
  };

  return (
    <>
      {/* Nút mở chat nhỏ gọn khi chat đang đóng */}
      {!isExpanded && (
        <button
          className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 focus:outline-none"
          onClick={() => setIsExpanded(true)}
          aria-label="Mở chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4.59-1.09L3 21l1.18-3.09C3.42 16.14 3 14.61 3 13c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Chat box overlay nổi khi mở */}
      {isExpanded && (
        <div className="fixed bottom-4 right-4 z-50 w-80 max-w-full">
          <div className={`bg-white rounded-lg shadow-lg relative ${className}`} style={{ minHeight: 400 }}>
            {/* Nút đóng chat */}
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl font-bold focus:outline-none"
              onClick={() => setIsExpanded(false)}
              aria-label="Đóng chat"
              type="button"
            >
              ×
            </button>
            {/* Header */}
            <div 
              className="flex items-center justify-between p-4 bg-blue-600 text-white rounded-t-lg cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                <h3 className="font-semibold">Chat</h3>
                {state.chatMessages.length > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    {state.chatMessages.length}
                  </span>
                )}
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex flex-col h-80">
              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50 max-h-80">
                {state.chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                    <p>Chưa có tin nhắn nào</p>
                    <p className="text-sm">Hãy gửi tin nhắn đầu tiên!</p>
                  </div>
                ) : (
                  <div>
                    {state.chatMessages.map((msg, index) => {
                      const style = getMessageStyle(msg);
                      return (
                        <div key={index} className={style.container}>
                          <div className="max-w-xs">
                            {msg.sender !== state.playerName && (
                              <div className={style.sender}>
                                {msg.sender}
                              </div>
                            )}
                            <div className={style.bubble}>
                              <div className="break-words">{msg.message}</div>
                              <div className={style.time}>
                                {formatTime(msg.timestamp)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={500}
                    disabled={!state.roomId}
                  />
                  <button
                    type="submit"
                    disabled={!state.roomId || !message.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
                {/* Character counter */}
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                  <span>
                    {state.roomId ? `Đang chat với ${state.opponentName}` : 'Chờ kết nối...'}
                  </span>
                  <span>
                    {message.length}/500
                  </span>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chat;
