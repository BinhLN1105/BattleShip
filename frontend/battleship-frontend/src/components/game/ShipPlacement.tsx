/**
 * ShipPlacement Component - Giao diện đặt tàu
 */

import React, { useState } from 'react';
import { Ship, ShipType, SHIP_CONFIGS, SHIP_IMAGES, Position, CellState, FLEET_CONFIGS } from '../../types/game';
import { useGame } from '../../contexts/GameContext';
import GameBoard from './GameBoard';

export const ShipPlacement: React.FC = () => {
  const { state, actions, dispatch } = useGame();
  const fleetConfig = FLEET_CONFIGS[state.myFleet] || FLEET_CONFIGS.modern;
  const [selectedShipType, setSelectedShipType] = useState<ShipType | null>(ShipType.DESTROYER);
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

  // Get ship icon from selected fleet theme
  const getShipIcon = (shipType: ShipType): string => {
    return fleetConfig.ships[shipType] || SHIP_IMAGES[shipType] || '/images/ships/modern/destroyer.png';
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
    setWaitingForOpponent(false);
  };

  // Thuật toán xếp tàu tự động (Random) đảm bảo 100% trong phạm vi 10x10 ô và không đè lên nhau
  const handleRandomPlacement = () => {
    const shipsToPlace: { type: ShipType; size: number }[] = [
      { type: ShipType.BATTLESHIP, size: 5 },
      { type: ShipType.CRUISER, size: 4 },
      { type: ShipType.SUBMARINE, size: 3 },
      { type: ShipType.SUBMARINE, size: 3 },
      { type: ShipType.DESTROYER, size: 2 },
    ];

    for (let attempt = 0; attempt < 300; attempt++) {
      const occupied = new Set<string>();
      const placed: Ship[] = [];
      let allFitted = true;

      for (const shipDef of shipsToPlace) {
        let placedThisShip = false;

        for (let t = 0; t < 100; t++) {
          const horizontal = Math.random() < 0.5;
          const maxRow = horizontal ? 10 : 10 - shipDef.size;
          const maxCol = horizontal ? 10 - shipDef.size : 10;
          const startRow = Math.floor(Math.random() * maxRow);
          const startCol = Math.floor(Math.random() * maxCol);

          const positions: Position[] = [];
          let collision = false;

          for (let i = 0; i < shipDef.size; i++) {
            const r = horizontal ? startRow : startRow + i;
            const c = horizontal ? startCol + i : startCol;
            if (r < 0 || r >= 10 || c < 0 || c >= 10 || occupied.has(`${r},${c}`)) {
              collision = true;
              break;
            }
            positions.push({ row: r, col: c });
          }

          if (!collision) {
            positions.forEach(p => occupied.add(`${p.row},${p.col}`));
            placed.push({
              type: shipDef.type,
              positions,
              isHorizontal: horizontal
            });
            placedThisShip = true;
            break;
          }
        }

        if (!placedThisShip) {
          allFitted = false;
          break;
        }
      }

      if (allFitted && placed.length === 5) {
        actions.setAllPlacedShips(placed);
        setSelectedShipType(null);
        setPreviewPositions([]);
        return;
      }
    }
  };

  // Xóa toàn bộ tàu đã xếp
  const handleClearAll = () => {
    actions.resetPlacement();
    setSelectedShipType(ShipType.DESTROYER);
    setPreviewPositions([]);
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center p-4 overflow-auto select-none">
      {/* Fixed background layer (z-0) */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/images/ocean-bg.png')" }}
      />
      <div className="fixed inset-0 z-0 bg-blue-950/70 pointer-events-none" />

      {/* Action button in top right */}
      <div className="fixed top-6 right-6 z-20 flex flex-col items-end gap-2">
        {allShipsPlaced && !waitingForOpponent && (
          <button
            onClick={handleCompletePlacement}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-2xl transition-all duration-200 transform hover:scale-105 border border-emerald-400/50 flex items-center gap-2"
          >
            ✓ Sẵn sàng chiến đấu
          </button>
        )}
        {waitingForOpponent && (
          <div className="bg-yellow-400 text-yellow-950 px-5 py-2.5 rounded-xl font-bold shadow-lg border border-yellow-200 flex items-center gap-2 animate-pulse">
            <span className="w-2.5 h-2.5 bg-yellow-900 rounded-full animate-ping" />
            Đang chờ đối thủ bố trí tàu...
          </div>
        )}
      </div>

      {/* Main Placement Container (z-10) */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center py-8">
        
        {/* Panel chọn thuyền - bên trái */}
        <div className="w-full max-w-md lg:w-96 bg-blue-900/90 rounded-2xl p-5 shadow-2xl border border-blue-700/60 max-h-[85vh] overflow-y-auto">
          {/* Commander Greeting */}
          <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-blue-700/50">
            <img 
              src={fleetConfig.commanderAvatar} 
              alt={fleetConfig.commanderName} 
              className="w-14 h-14 rounded-full object-cover border-2 border-yellow-400 shadow bg-slate-950 flex-shrink-0"
              draggable={false}
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">BỐ TRÍ HẠM ĐỘI</h2>
                <span className="text-[10px] bg-yellow-400/20 text-yellow-300 font-bold px-1.5 py-0.5 rounded border border-yellow-400/40">
                  {fleetConfig.name}
                </span>
              </div>
              <p className="text-xs text-blue-200">
                {fleetConfig.commanderName} - <b className="text-yellow-300">{state.playerName || 'Chỉ huy'}</b>
              </p>
              <p className="text-[11px] text-blue-300/80 italic mt-0.5 line-clamp-1">"{fleetConfig.quote}"</p>
            </div>
          </div>

          {waitingForOpponent ? (
            <div className="flex flex-col items-center gap-5 my-8">
              <div className="text-blue-100 text-base font-semibold text-center">
                Toàn bộ tàu chiến đã vào vị trí.<br/>Đang kết nối tín hiệu với đối thủ...
              </div>
              <button
                onClick={handleCancelWaiting}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow"
              >
                Hủy & Điều chỉnh lại
              </button>
            </div>
          ) : (
            <>
              {/* Orientation Toggle */}
              <div className="mb-5">
                <label className="block text-blue-200 text-xs font-bold mb-2 uppercase tracking-wider">
                  Hướng đặt tàu:
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsHorizontal(true)}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                      isHorizontal 
                        ? 'bg-blue-600 text-white shadow-md border border-blue-400' 
                        : 'bg-blue-950/60 text-blue-200 hover:bg-blue-800/60 border border-blue-800'
                    }`}
                  >
                    Ngang →
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsHorizontal(false)}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                      !isHorizontal 
                        ? 'bg-blue-600 text-white shadow-md border border-blue-400' 
                        : 'bg-blue-950/60 text-blue-200 hover:bg-blue-800/60 border border-blue-800'
                    }`}
                  >
                    Dọc ↓
                  </button>
                </div>
              </div>

              {/* Ship Types list */}
              <div className="space-y-3 mb-5">
                {Object.entries(SHIP_CONFIGS).map(([shipType, config]) => {
                  const availableCount = state.availableShips[shipType as ShipType];
                  const isSelected = selectedShipType === shipType;
                  const isDisabled = availableCount <= 0;
                  return (
                    <button
                      key={shipType}
                      type="button"
                      onClick={() => handleShipSelect(shipType as ShipType)}
                      disabled={isDisabled}
                      className={`w-full p-3 rounded-xl border-2 transition-all duration-150 text-left ${
                        isSelected
                          ? 'border-yellow-400 bg-blue-800/90 shadow-lg ring-2 ring-yellow-400/30'
                          : isDisabled
                          ? 'border-slate-700/50 bg-slate-900/40 opacity-40 cursor-not-allowed'
                          : 'border-blue-700/60 bg-blue-950/50 hover:border-blue-500 hover:bg-blue-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-11 bg-slate-950/80 rounded-lg flex items-center justify-center p-1 border border-blue-700/40 flex-shrink-0">
                          <img 
                            src={getShipIcon(shipType as ShipType)} 
                            alt={config.name}
                            className="max-w-full max-h-full object-contain filter drop-shadow"
                            draggable={false}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-sm truncate flex items-center justify-between">
                            <span>{config.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              availableCount > 0 ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-400'
                            }`}>
                              x{availableCount}
                            </span>
                          </div>
                          <div className="text-xs text-blue-300 mt-0.5">
                            Chiều dài: <b className="text-yellow-300">{config.size} ô</b>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Placed Ships List */}
              {state.placedShips.length > 0 && (
                <div className="mb-4 pt-3 border-t border-blue-700/50">
                  <h3 className="text-xs font-bold text-blue-200 mb-2 uppercase tracking-wider">Tàu đã đặt ({state.placedShips.length}/5):</h3>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {state.placedShips.map((ship, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-blue-950/70 px-3 py-1.5 rounded-lg border border-blue-800 text-xs"
                      >
                        <span className="text-blue-100 font-medium">
                          {SHIP_CONFIGS[ship.type].name} ({ship.isHorizontal ? 'Ngang' : 'Dọc'})
                        </span>
                        <button
                          onClick={() => actions.removeShip(index)}
                          className="text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded hover:bg-red-950/60 transition-colors"
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

        {/* GameBoard căn giữa */}
        <div className="flex-1 max-w-lg flex flex-col items-center">
          <div className="w-full bg-slate-900/40 rounded-2xl p-5 shadow-2xl border border-blue-500/20 backdrop-blur-sm flex flex-col items-center">
            {/* Quick Actions: Xếp tự động & Xóa tất cả */}
            {!waitingForOpponent && (
              <div className="flex items-center justify-between w-full max-w-sm mb-3.5 gap-2">
                <button
                  type="button"
                  onClick={handleRandomPlacement}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-purple-400/40 flex items-center justify-center gap-1.5 transition-all transform active:scale-95"
                >
                  <span className="text-base">🎲</span> Xếp Tự Động (Random)
                </button>
                {state.placedShips.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-red-900/80 text-slate-300 hover:text-white font-bold text-xs sm:text-sm shadow border border-slate-700/60 flex items-center justify-center gap-1 transition-all"
                  >
                    <span>🗑️</span> Xóa hết
                  </button>
                )}
              </div>
            )}

            <GameBoard
              board={getBoardWithPreview()}
              placedShips={state.placedShips}
              onCellClick={waitingForOpponent ? undefined : handleCellClick}
              onCellHover={waitingForOpponent ? undefined : handleCellHover}
              onCellLeave={waitingForOpponent ? undefined : handleCellLeave}
              className="mx-auto text-center"
            />

            {/* Progress */}
            <div className="mt-5 text-center w-full max-w-sm">
              <div className="text-blue-100 text-sm font-semibold mb-2 flex justify-between">
                <span>Tiến độ bố trí:</span>
                <span className="text-yellow-300 font-bold">{state.placedShips.length} / 5 tàu</span>
              </div>
              <div className="w-full bg-blue-950/80 rounded-full h-3 border border-blue-800 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300 shadow"
                  style={{ 
                    width: `${(state.placedShips.length / 5) * 100}%` 
                  }}
                />
              </div>
            </div>

            {selectedShipType && !waitingForOpponent && (
              <div className="mt-3 text-center">
                <div className="inline-block bg-yellow-400/95 text-yellow-950 px-4 py-1.5 rounded-lg text-xs font-bold shadow">
                  Đang chọn: {SHIP_CONFIGS[selectedShipType].name} ({SHIP_CONFIGS[selectedShipType].size} ô) - {isHorizontal ? 'Ngang' : 'Dọc'}
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
