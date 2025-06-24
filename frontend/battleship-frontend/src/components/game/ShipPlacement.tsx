/**
 * ShipPlacement Component - Giao diện đặt tàu
 */

import React, { useState } from 'react';
import { ShipType, SHIP_CONFIGS, Position, CellState } from '../../types/game';
import { useGame } from '../../contexts/GameContext';
import GameBoard from './GameBoard';

export const ShipPlacement: React.FC = () => {
  const { state, actions, dispatch } = useGame();
  const [selectedShipType, setSelectedShipType] = useState<ShipType | null>(null);
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [previewPositions, setPreviewPositions] = useState<Position[]>([]);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Handle ship selection
  const handleShipSelect = (shipType: ShipType) => {
    if (state.availableShips[shipType] > 0) {
      setSelectedShipType(shipType);
    }
  };

  // Handle cell hover for ship preview
  const handleCellHover = (row: number, col: number) => {
    if (selectedShipType) {
      const shipSize = SHIP_CONFIGS[selectedShipType].size;
      const positions: Position[] = [];
      for (let i = 0; i < shipSize; i++) {
        const pos = isHorizontal 
          ? { row, col: col + i }
          : { row: row + i, col };
        // Check boundaries
        if (pos.row >= 10 || pos.col >= 10 || pos.row < 0 || pos.col < 0) {
          if (previewPositions.length > 0) setPreviewPositions([]);
          return;
        }
        // Check if cell is already occupied
        if (state.myBoard[pos.row][pos.col] !== CellState.WATER) {
          if (previewPositions.length > 0) setPreviewPositions([]);
          return;
        }
        positions.push(pos);
      }
      // So sánh mảng positions trước khi setPreviewPositions để tránh setState liên tục
      const isSame = positions.length === previewPositions.length && positions.every((p, i) => p.row === previewPositions[i]?.row && p.col === previewPositions[i]?.col);
      if (!isSame) setPreviewPositions(positions);
    }
  };

  // Handle cell click to place ship
  const handleCellClick = (row: number, col: number) => {
    if (selectedShipType && previewPositions.length > 0) {
      const success = actions.placeShip(selectedShipType, { row, col }, isHorizontal);
      if (success) {
        setPreviewPositions([]);
        // Auto-select next available ship type or clear selection
        const remainingShips = state.availableShips[selectedShipType] - 1;
        if (remainingShips <= 0) {
          // Find next available ship type
          const nextShipType = Object.entries(state.availableShips).find(
            ([type, count]) => type !== selectedShipType && count > 0
          )?.[0] as ShipType;
          setSelectedShipType(nextShipType || null);
        }
      }
    }
  };

  // Clear preview when mouse leaves board
  const handleCellLeave = () => {
    setPreviewPositions([]);
  };

  // Check if all ships are placed
  const allShipsPlaced = Object.values(state.availableShips).every(count => count === 0);

  // Create board with preview
  const getBoardWithPreview = () => {
    const board = state.myBoard.map(row => [...row]);
    
    // Add preview positions
    previewPositions.forEach(pos => {
      if (board[pos.row][pos.col] === CellState.WATER) {
        board[pos.row][pos.col] = 'preview' as any; // Temporary state for preview
      }
    });
    
    return board;
  };

  // Get ship icon
  const getShipIcon = (shipType: ShipType): string => {
    const iconMap = {
      [ShipType.DESTROYER]: '/images/destroyer-icon.jpg',
      [ShipType.SUBMARINE]: '/images/submarine-icon.jpg',
      [ShipType.CRUISER]: '/images/cruiser-icon.jpg',
      [ShipType.BATTLESHIP]: '/images/battleship-icon.jpg'
    };
    return iconMap[shipType];
  };

  // Khi nhấn Hoàn thành đặt tàu
  const handleCompletePlacement = () => {
    // Kiểm tra mỗi loại tàu phải đặt đúng số lượng quy định trong SHIP_CONFIGS
    const typeCounts: Record<string, number> = {};
    state.placedShips.forEach(ship => {
      typeCounts[ship.type] = (typeCounts[ship.type] || 0) + 1;
    });
    const allTypes = Object.keys(SHIP_CONFIGS);
    const missing = allTypes.filter(type => !typeCounts[type] || typeCounts[type] !== SHIP_CONFIGS[type as ShipType].count);
    if (missing.length > 0) {
      dispatch({ type: 'SET_ERROR', payload: 'Bạn phải đặt đúng số lượng mỗi loại tàu theo quy định!' });
      return;
    }
    actions.completeShipPlacement();
    setWaitingForOpponent(true);
  };

  // Khi nhấn Hủy chờ đối thủ
  const handleCancelWaiting = () => {
    // Không resetGame, chỉ quay lại màn hình đặt tàu với các tàu đã đặt giữ nguyên
    setWaitingForOpponent(false);
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center p-4 overflow-auto">
      {/* Overlay và nền CHỈ render khi component này thực sự được render (đảm bảo không bị giữ lại khi chuyển màn hình) */}
      {true && (
        <>
          <div className="fixed inset-0 z-0 h-screen w-screen pointer-events-none">
            <img src="/images/ocean-bg.png" alt="ocean background" className="w-full h-full object-cover" />
          </div>
          <div className="fixed inset-0 bg-blue-900 bg-opacity-40 pointer-events-none h-screen w-screen"></div>
        </>
      )}

      {/* Nút hoàn thành đặt tàu ở góc trên bên phải */}
      <div className="absolute top-8 right-8 z-20 flex flex-col items-end gap-2">
        {allShipsPlaced && !waitingForOpponent && (
          <button
            onClick={handleCompletePlacement}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-green-700 transition-all duration-200"
          >
            Hoàn thành đặt tàu
          </button>
        )}
        {waitingForOpponent && (
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-medium shadow">Đang chờ đối thủ...</div>
        )}
      </div>

      {/* Nội dung đặt tàu: panel chọn thuyền + GameBoard */}
      <div className="relative z-20 w-full flex flex-col lg:flex-row gap-8 items-start justify-center h-full lg:items-start lg:justify-center">
        {/* Panel chọn thuyền - bên trái trên PC, phía trên trên mobile */}
        <div className="w-full max-w-lg lg:max-w-xs bg-blue-800 rounded-lg p-6 shadow-lg bg-opacity-80 backdrop-blur-md mb-6 lg:mb-0 max-h-[80vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Đặt Tàu Chiến</h2>
          {/* Nếu đang chờ đối thủ thì chỉ hiện thông báo và nút Hủy */}
          {waitingForOpponent ? (
            <div className="flex flex-col items-center gap-6 mt-12">
              <div className="text-white text-lg font-semibold text-center">Chờ đối thủ đặt tàu...</div>
              <button
                onClick={handleCancelWaiting}
                className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-lg"
              >
                Hủy
              </button>
            </div>
          ) : (
            <>
              {/* Orientation Toggle */}
              <div className="mb-6">
                <label className="block text-white text-sm font-medium mb-2">Hướng đặt tàu:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsHorizontal(true)}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                      isHorizontal 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-blue-200 text-blue-800 hover:bg-blue-300'
                    }`}
                  >
                    Ngang →
                  </button>
                  <button
                    onClick={() => setIsHorizontal(false)}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                      !isHorizontal 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-blue-200 text-blue-800 hover:bg-blue-300'
                    }`}
                  >
                    Dọc ↓
                  </button>
                </div>
              </div>
              {/* Ship Types */}
              <div className="space-y-4 mb-6">
                {Object.entries(SHIP_CONFIGS).map(([shipType, config]) => {
                  const availableCount = state.availableShips[shipType as ShipType];
                  const isSelected = selectedShipType === shipType;
                  const isDisabled = availableCount <= 0;
                  return (
                    <button
                      key={shipType}
                      onClick={() => handleShipSelect(shipType as ShipType)}
                      disabled={isDisabled}
                      className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-yellow-400 bg-yellow-100 shadow-lg transform scale-105'
                          : isDisabled
                          ? 'border-gray-500 bg-gray-300 opacity-50 cursor-not-allowed'
                          : 'border-blue-300 bg-white hover:border-blue-500 hover:shadow-md hover:scale-102'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={getShipIcon(shipType as ShipType)} 
                          alt={config.name}
                          className="w-12 h-8 object-cover rounded"
                        />
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-gray-800">{config.name}</div>
                          <div className="text-sm text-gray-600">
                            Kích thước: {config.size} ô
                          </div>
                          <div className="text-sm text-gray-600">
                            Còn lại: {availableCount}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Instructions */}
              <div className="bg-blue-100 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-blue-800 mb-2">Hướng dẫn:</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>1. Chọn loại tàu từ danh sách</li>
                  <li>2. Chọn hướng đặt (ngang/dọc)</li>
                  <li>3. Nhấp vào bảng để đặt tàu</li>
                  <li>4. Nhấp vào tàu đã đặt để xóa</li>
                </ul>
              </div>
              {/* Placed Ships List */}
              {state.placedShips.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-white mb-2">Tàu đã đặt:</h3>
                  <div className="space-y-2">
                    {state.placedShips.map((ship, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-blue-100 p-2 rounded"
                      >
                        <span className="text-sm text-blue-800">
                          {SHIP_CONFIGS[ship.type].name}
                        </span>
                        <button
                          onClick={() => actions.removeShip(index)}
                          className="text-red-600 hover:text-red-800 text-xs px-2 py-1 bg-red-100 rounded hover:bg-red-200"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {/* GameBoard căn giữa tuyệt đối trên PC */}
        <div className="w-full max-w-lg mx-auto flex flex-col justify-center items-center">
          <div className="w-full bg-white bg-opacity-30 rounded-lg p-4 backdrop-blur-md flex flex-col items-center">
            <GameBoard
              board={getBoardWithPreview()}
              onCellClick={waitingForOpponent ? undefined : handleCellClick}
              onCellHover={waitingForOpponent ? undefined : handleCellHover}
              onCellLeave={waitingForOpponent ? undefined : handleCellLeave}
              className="mx-auto"
            />
            {/* Progress */}
            <div className="mt-6 text-center w-full">
              <div className="text-white text-lg font-medium mb-2">
                Tiến độ: {state.placedShips.length} / {Object.values(SHIP_CONFIGS).reduce((total, config) => total + config.count, 0)} tàu
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(state.placedShips.length / Object.values(SHIP_CONFIGS).reduce((total, config) => total + config.count, 0)) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
            {selectedShipType && !waitingForOpponent && (
              <div className="mt-4 text-center w-full">
                <div className="inline-block bg-yellow-400 text-yellow-900 px-4 py-2 rounded-lg font-medium">
                  Đang đặt: {SHIP_CONFIGS[selectedShipType].name} ({SHIP_CONFIGS[selectedShipType].size} ô)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShipPlacement;
