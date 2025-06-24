/**
 * GameInterface Component - Giao diện chính của game khi đang chơi
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { GameState, CellState } from '../../types/game';
import GameBoard from './GameBoard';
import Chat from './Chat';

export const GameInterface: React.FC = () => {
  const { state, actions } = useGame();
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    setShowChat(true); // Tự động mở chat khi vào màn hình chơi
  }, []);

  // Handle surrender
  const handleSurrender = () => {
    if (window.confirm('Bạn có chắc chắn muốn đầu hàng không?')) {
      actions.surrender();
    }
  };

  // Handle new game
  const handleNewGame = async () => {
    await actions.resetGame();
    // Reset lại các state UI của Login (nếu có window object)
    if (typeof window !== 'undefined') {
      // Sử dụng custom event để Login.tsx lắng nghe và set lại state UI
      window.dispatchEvent(new Event('autoStartLogin'));
    }
    if (state.playerName && state.playerName.trim().length > 0) {
      await actions.connect();
      actions.joinQueue();
    }
  };

  // Get turn indicator
  const getTurnIndicator = () => {
    if (state.gameState === GameState.FINISHED) {
      const isWinner = state.winner === state.clientId;
      return (
        <div className={`text-center py-3 px-6 rounded-lg font-bold text-lg ${
          isWinner ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {isWinner ? '🎉 Bạn đã thắng!' : '😔 Bạn đã thua!'}
        </div>
      );
    }

    // Hiển thị thời gian còn lại cho lượt hiện tại
    return (
      <div className={`text-center py-2 px-4 rounded-lg font-semibold flex flex-col items-center gap-1 ${
        state.isMyTurn 
          ? 'bg-green-500 text-white animate-pulse' 
          : 'bg-gray-400 text-white'
      }`}>
        <span>
          {state.isMyTurn ? '🎯 Lượt của bạn - Hãy bắn!' : '⏳ Đợi lượt đối thủ...'}
        </span>
        <span className="text-xs font-mono bg-black bg-opacity-30 px-2 py-1 rounded">
          Thời gian còn lại: <b>{state.turnTimeLeft}s</b>
        </span>
      </div>
    );
  };

  // Get game stats
  const getGameStats = () => {
    const myHits = state.opponentBoard.flat().filter(cell => cell === CellState.HIT).length;
    const myMisses = state.opponentBoard.flat().filter(cell => cell === CellState.MISS).length;
    const opponentHits = state.myBoard.flat().filter(cell => cell === CellState.HIT).length;
    const opponentMisses = state.myBoard.flat().filter(cell => cell === CellState.MISS).length;

    return { myHits, myMisses, opponentHits, opponentMisses };
  };

  const { myHits, myMisses, opponentHits, opponentMisses } = getGameStats();

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center relative p-4 z-20"
      style={{ backgroundImage: "url('/images/ocean-background.jpg')" }}
    >
      {/* Overlay để làm tối nhẹ background cho dễ nhìn */}
      <div className="absolute inset-0 bg-blue-900 bg-opacity-50 pointer-events-none z-10"></div>
      {/* Nội dung game */}
      <div className="relative z-10 max-w-7xl mx-auto mb-6">
        <div className="bg-blue-800 bg-opacity-80 rounded-lg p-4 shadow-lg">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Game Info */}
            <div className="flex items-center gap-6">
              <div className="text-white">
                <h1 className="text-2xl font-bold">Battle Ship</h1>
                <p className="text-blue-200 flex flex-col gap-1">
                  <span>{state.playerName} <span className="text-xs text-green-300">(Bạn)</span></span>
                  <span>{state.opponentName || '(Đang chờ...)'} <span className="text-xs text-yellow-200">(Đối thủ)</span></span>
                </p>
              </div>
              
              {/* Room ID */}
              <div className="text-blue-200 text-sm">
                Room: {state.roomId}
              </div>
            </div>

            {/* Turn Indicator */}
            <div className="flex-1 max-w-sm">
              {getTurnIndicator()}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              
              {state.gameState === GameState.PLAYING && (
                <button
                  onClick={handleSurrender}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  🏳️ Đầu hàng
                </button>
              )}
              
              {state.gameState === GameState.FINISHED && (
                <button
                  onClick={handleNewGame}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  🎮 Chơi lại
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* My Board */}
          <div className="xl:col-span-1">
            <div className="bg-white bg-opacity-30 rounded-lg p-2">
              <GameBoard
                board={state.myBoard}
                isOpponentBoard={false}
                className="w-full"
              />
            </div>
            
            {/* My Stats */}
            <div className="mt-4 bg-blue-800 bg-opacity-80 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">Thống kê của bạn</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-blue-200">
                  <div>Tàu còn lại:</div>
                  <div className="text-white font-bold">
                    {state.myShips.filter(ship => !ship.hits || ship.hits.size < ship.positions.length).length}
                  </div>
                </div>
                <div className="text-blue-200">
                  <div>Bị trúng:</div>
                  <div className="text-red-400 font-bold">{opponentHits}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Opponent Board */}
          <div className="xl:col-span-1">
            <div className="bg-white bg-opacity-30 rounded-lg p-2">
              <GameBoard
                board={state.opponentBoard}
                isOpponentBoard={true}
                canShoot={state.gameState === GameState.PLAYING}
                className="w-full"
              />
            </div>
            
            {/* Opponent Stats */}
            <div className="mt-4 bg-blue-800 bg-opacity-80 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">Thống kê đối thủ</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-blue-200">
                  <div>Bắn trúng:</div>
                  <div className="text-green-400 font-bold">{myHits}</div>
                </div>
                <div className="text-blue-200">
                  <div>Bắn trượt:</div>
                  <div className="text-red-400 font-bold">{myMisses}</div>
                </div>
              </div>
              
              {/* Accuracy */}
              <div className="mt-2 text-blue-200 text-sm">
                <div>Độ chính xác:</div>
                <div className="text-white font-bold">
                  {myHits + myMisses > 0 
                    ? Math.round((myHits / (myHits + myMisses)) * 100) 
                    : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="xl:col-span-1">
            <div className="space-y-4">
              {/* Chat */}
              {showChat && (
                <Chat className="w-full" />
              )}
              
              {/* Game Instructions */}
              <div className="bg-blue-800 bg-opacity-80 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3">Hướng dẫn</h3>
                <ul className="text-blue-200 text-sm space-y-1">
                  <li>• Nhấp vào ô trên bảng đối thủ để bắn</li>
                  <li>• Ô đỏ = Trúng tàu</li>
                  <li>• Ô xanh = Bắn trượt</li>
                  <li>• Chìm hết tàu đối thủ để thắng</li>
                </ul>
              </div>

              {/* Legend */}
              <div className="bg-blue-800 bg-opacity-80 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3">Chú thích</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300"></div>
                    <span className="text-blue-200">Nước</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-600 border border-gray-800"></div>
                    <span className="text-blue-200">Tàu của bạn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 border border-red-700"></div>
                    <span className="text-blue-200">Trúng</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-300 border border-blue-500"></div>
                    <span className="text-blue-200">Trượt</span>
                  </div>
                </div>
              </div>

              {/* Connection Status */}
              <div className="bg-blue-800 bg-opacity-80 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Trạng thái kết nối</h3>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-blue-200 text-sm">Đã kết nối</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {state.gameState === GameState.FINISHED && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-6xl mb-4">
                {state.winner === state.clientId ? '🎉' : '😔'}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {state.winner === state.clientId ? 'Chúc mừng!' : 'Thất bại!'}
              </h2>
              <p className="text-gray-600 mb-6">
                {state.winner === state.clientId 
                  ? 'Bạn đã chiến thắng!' 
                  : `${state.opponentName} đã thắng!`}
              </p>
              
              {/* Final Stats */}
              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <h3 className="font-semibold mb-2">Thống kê cuối game</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Bắn trúng:</div>
                    <div className="font-bold">{myHits}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Bắn trượt:</div>
                    <div className="font-bold">{myMisses}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Độ chính xác:</div>
                    <div className="font-bold">
                      {myHits + myMisses > 0 
                        ? Math.round((myHits / (myHits + myMisses)) * 100) 
                        : 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Tổng bắn:</div>
                    <div className="font-bold">{myHits + myMisses}</div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleNewGame}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Chơi game mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameInterface;
