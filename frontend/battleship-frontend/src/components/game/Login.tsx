/**
 * Login Component - Giao diện đăng nhập và kết nối
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { GameState } from '../../types/game';

export const Login: React.FC = () => {
  const { state, actions, dispatch } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnecting, setShowConnecting] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // Khi nhập tên, hiện text đang kết nối
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 50);
    setPlayerName(value);
    if (value.trim().length >= 2) {
      setShowConnecting(true);
    } else {
      setShowConnecting(false);
    }
  };

  // Khi ấn bắt đầu chơi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setIsConnecting(true);
    setShowConnecting(true);
    try {
      dispatch({ type: 'SET_PLAYER_NAME', payload: playerName.trim() });
      await actions.connect();
      setShowQueue(true);
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Khi ấn Hủy tìm đối thủ
  const handleCancelQueue = () => {
    actions.leaveQueue();
    setShowQueue(false);
    setShowConnecting(false);
    setPlayerName('');
  };

  // Luôn đồng bộ input với state.playerName
  useEffect(() => {
    setPlayerName(state.playerName || '');
  }, [state.playerName]);

  // Tự động connect và joinQueue nếu đã có playerName
  useEffect(() => {
    if (
      state.playerName &&
      state.playerName.trim().length > 0 &&
      state.connectionState === GameState.DISCONNECTED
    ) {
      setShowQueue(true);         // Hiện trạng thái như vừa ấn nút
      setShowConnecting(true);
      (async () => {
        dispatch({ type: 'SET_PLAYER_NAME', payload: state.playerName });
        await actions.connect();
      })();
    }
  }, [state.playerName, state.connectionState, dispatch, actions]);

  // Tự động joinQueue khi đã kết nối thành công
  useEffect(() => {
    if ((showQueue || isConnecting) && state.connectionState === GameState.CONNECTED) {
      actions.joinQueue();
    }
  }, [state.connectionState, showQueue, isConnecting, actions]);

  // Lắng nghe sự kiện autoStartLogin để tự động chuyển trạng thái UI
  useEffect(() => {
    const handler = () => {
      setIsConnecting(true);
      setShowConnecting(true);
      setShowQueue(true);
    };
    window.addEventListener('autoStartLogin', handler);
    return () => window.removeEventListener('autoStartLogin', handler);
  }, []);

  // Xác định text trạng thái
  let statusText = '';
  if (showQueue || state.connectionState === GameState.IN_QUEUE) {
    if (state.opponentName) {
      statusText = 'Đã tìm thấy đối thủ xứng tầm!';
    } else {
      statusText = 'Đang tìm đối thủ...';
    }
  } else if (showConnecting || state.connectionState === GameState.CONNECTING) {
    statusText = 'Đang kết nối...';
  }

  // Connection status message
  const getStatusMessage = () => {
    switch (state.connectionState) {
      case GameState.CONNECTING:
        return 'Đang kết nối...';
      case GameState.CONNECTED:
        return 'Đã kết nối thành công!';
      case GameState.IN_QUEUE:
        return `Đang tìm đối thủ... (Vị trí: ${state.queuePosition})`;
      case GameState.DISCONNECTED:
        return state.error || 'Chưa kết nối';
      default:
        return '';
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (state.connectionState) {
      case GameState.CONNECTING:
        return 'text-yellow-600';
      case GameState.CONNECTED:
      case GameState.IN_QUEUE:
        return 'text-green-600';
      case GameState.DISCONNECTED:
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  useEffect(() => {
    // Khi vào màn hình Login, xóa clientId cũ để mỗi tab là 1 client mới
    if (typeof window !== 'undefined') {
      localStorage.removeItem('battleship_client_id');
    }
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ảnh nền biển phủ full màn hình */}
      <div className="absolute inset-0 z-0">
        <img src="/images/ocean-bg.png" alt="ocean background" className="w-full h-full object-cover" />
      </div>
      {/* Overlay tối nhẹ để dễ nhìn chữ */}
      <div className="absolute inset-0 bg-blue-900 bg-opacity-40 z-10"></div>
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden z-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
      </div>
      <div className="relative z-30 w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-white rounded-full shadow-lg mb-4">
            <svg className="w-12 h-12 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Battle Ship</h1>
          <p className="text-blue-200 text-lg">Trò chơi hải chiến trực tuyến</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-2">
                Tên người chơi
              </label>
              <input
                type="text"
                id="playerName"
                value={playerName}
                onChange={handleNameChange}
                placeholder="Nhập tên của bạn..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
                required
                minLength={2}
                maxLength={50}
                disabled={isConnecting || showQueue || state.connectionState === GameState.CONNECTING || state.connectionState === GameState.IN_QUEUE}
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">
                  Tối thiểu 2 ký tự
                </span>
                <span className="text-xs text-gray-500">
                  {playerName.length}/50
                </span>
              </div>
            </div>

            {/* Nút và trạng thái */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={
                  !playerName.trim() || isConnecting || showQueue || state.connectionState === GameState.CONNECTING || state.connectionState === GameState.IN_QUEUE
                }
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 text-lg shadow-lg"
              >
                Bắt đầu chơi
              </button>
              {statusText && (
                <div className="text-center text-sm text-blue-700 font-medium flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {statusText}
                  {((showQueue || state.connectionState === GameState.IN_QUEUE) && !state.opponentName) && (
                    <button
                      type="button"
                      onClick={handleCancelQueue}
                      className="ml-3 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-semibold border border-red-300"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Game Rules */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Luật chơi:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Đặt tàu trên bảng 10x10</li>
                <li>• 4 Destroyer (2 ô), 3 Submarine (3 ô)</li>
                <li>• 2 Cruiser (4 ô), 1 Battleship (5 ô)</li>
                <li>• Lần lượt bắn để tìm và chìm tàu đối thủ</li>
                <li>• Người chìm hết tàu đối thủ trước sẽ thắng</li>
              </ul>
            </div>
          </form>

          {/* Footer */}
          <div className="text-center mt-6 text-blue-200">
            <p className="text-sm">
              Kết nối tới server: localhost:8888
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
