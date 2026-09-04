/**
 * GameBoard Component - Hiển thị và xử lý tương tác với bảng game
 */

import React from 'react';
import { CellState, Position, Ship, SunkShip, ShipType, SHIP_IMAGES, SHIP_CONFIGS, FLEET_CONFIGS } from '../../types/game';
import { useGame } from '../../contexts/GameContext';

interface GameBoardProps {
  board: CellState[][];
  isOpponentBoard?: boolean;
  canShoot?: boolean;
  placedShips?: Ship[];
  sunkShips?: SunkShip[];
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (row: number, col: number) => void;
  onCellLeave?: () => void;
  className?: string;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  isOpponentBoard = false,
  canShoot = false,
  placedShips = [],
  sunkShips = [],
  onCellClick,
  onCellHover,
  onCellLeave,
  className = ''
}) => {
  const { state, actions } = useGame();

  // Cell click handler
  const handleCellClick = (row: number, col: number) => {
    if (onCellClick) {
      onCellClick(row, col);
    } else if (isOpponentBoard && canShoot && state.isMyTurn) {
      // Only allow shooting on empty water cells on opponent board
      if (board[row][col] === CellState.WATER) {
        actions.fireShot(row, col);
      }
    }
  };

  // Cell hover handler
  const handleCellHover = (row: number, col: number) => {
    if (onCellHover) {
      onCellHover(row, col);
    }
  };

  // Get cell CSS classes based on state
  const getCellClasses = (row: number, col: number, cellState: any): string => {
    const baseClasses = 'w-8 h-8 border border-blue-300 relative select-none touch-none transition-colors duration-150';
    
    let stateClasses = '';
    // Xử lý trạng thái preview khi đặt tàu
    if (cellState === 'preview') {
      stateClasses = 'bg-emerald-400/70 border-emerald-500 shadow-inner ring-2 ring-emerald-300 ring-inset z-10';
    } else {
      switch (cellState) {
        case CellState.WATER:
          stateClasses = 'bg-blue-100 hover:bg-blue-200';
          break;
        case CellState.SHIP:
          // BẢO MẬT: Bảng đối thủ tuyệt đối KHÔNG lộ style ship trong DOM
          stateClasses = isOpponentBoard ? 'bg-blue-100 hover:bg-blue-200' : 'bg-slate-700 border-slate-900';
          break;
        case CellState.HIT:
          stateClasses = 'bg-red-600 border-red-800';
          break;
        case CellState.MISS:
          stateClasses = 'bg-blue-400 border-blue-600';
          break;
        default:
          stateClasses = 'bg-blue-100';
          break;
      }
    }

    // Cursor styles
    const cursorClasses = canShoot && isOpponentBoard && state.isMyTurn && cellState === CellState.WATER
      ? 'cursor-crosshair hover:z-10'
      : 'cursor-default';

    // Hover effects for opponent board
    const hoverClasses = isOpponentBoard && canShoot && state.isMyTurn && cellState === CellState.WATER
      ? 'hover:ring-2 hover:ring-red-400 hover:ring-inset hover:z-10'
      : '';

    // Không cho click lại các ô đã bắn
    const disabledClasses = (cellState === CellState.HIT || cellState === CellState.MISS) ? 'opacity-85 pointer-events-none' : '';

    return `${baseClasses} ${stateClasses} ${cursorClasses} ${hoverClasses} ${disabledClasses}`;
  };

  // Render cell content (icons for hit/miss)
  const renderCellContent = (cellState: any): JSX.Element | null => {
    if (cellState === 'preview') {
      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2.5 h-2.5 bg-emerald-700/60 rounded-full animate-ping" />
        </div>
      );
    }

    switch (cellState) {
      case CellState.HIT:
        return (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-3 h-3 bg-white rounded-full opacity-80 shadow"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-xs font-bold leading-none select-none">×</span>
            </div>
          </div>
        );
      case CellState.MISS:
        return (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-2 h-2 bg-white rounded-full opacity-70"></div>
          </div>
        );
      case CellState.SHIP:
        return !isOpponentBoard ? (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800 pointer-events-none">
            <div className="w-full h-full border border-slate-500/30 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-400/50 rounded-full"></div>
            </div>
          </div>
        ) : null;
      default:
        return null;
    }
  };

  // Row and column labels
  const rowLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  return (
    <div className={`inline-block select-none ${className}`}>
      {/* Title */}
      <div className="text-center mb-3">
        <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
          {isOpponentBoard ? `Bảng của ${state.opponentName || 'Đối thủ'}` : `Bảng của bạn (${state.playerName})`}
        </h3>
        {isOpponentBoard && canShoot && (
          <p className="text-xs text-blue-200 mt-1">
            {state.isMyTurn ? '🎯 Nhấp vào ô để phóng tên lửa!' : '⏳ Đợi lượt đối thủ...'}
          </p>
        )}
      </div>

      {/* Board with labels */}
      <div className="bg-blue-900/90 p-3.5 rounded-xl shadow-2xl border border-blue-700/50">
        {/* Column labels */}
        <div className="flex mb-1">
          <div className="w-6"></div> {/* Empty corner */}
          {colLabels.map((label, index) => (
            <div key={index} className="w-8 h-6 flex items-center justify-center text-blue-200 font-bold text-xs select-none">
              {label}
            </div>
          ))}
        </div>

        {/* Rows with row labels and cells wrapper */}
        <div className="flex flex-col relative">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {/* Row label */}
              <div className="w-6 h-8 flex items-center justify-center text-blue-200 font-bold text-xs select-none">
                {rowLabels[rowIndex]}
              </div>
              
              {/* Cells row */}
              <div className="flex">
                {row.map((cellState, colIndex) => (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    className={getCellClasses(rowIndex, colIndex, cellState)}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                    onMouseLeave={onCellLeave}
                    onDragStart={(e) => e.preventDefault()}
                    disabled={!canShoot && isOpponentBoard}
                    title={`${colLabels[colIndex]}${rowLabels[rowIndex]}`}
                    type="button"
                  >
                    {renderCellContent(cellState)}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Placed Ships Overlay: Hiển thị đồ họa tàu chiến khi người chơi bố trí */}
          {!isOpponentBoard && placedShips && placedShips.filter(ps => !sunkShips.some(ss =>
            ss.positions.length === ps.positions.length &&
            ss.positions.every((p, idx) => p.row === ps.positions[idx]?.row && p.col === ps.positions[idx]?.col)
          )).map((ship, idx) => {
            if (!ship.positions || ship.positions.length === 0) return null;
            const rows = ship.positions.map(p => p.row);
            const cols = ship.positions.map(p => p.col);
            const minRow = Math.min(...rows);
            const minCol = Math.min(...cols);
            const maxRow = Math.max(...rows);
            const maxCol = Math.max(...cols);
            const spanRows = maxRow - minRow + 1;
            const spanCols = maxCol - minCol + 1;
            const isHorizontal = ship.isHorizontal ?? (spanCols >= spanRows);
            const fleetKey = state.myFleet || 'modern';
            const shipImgSrc = FLEET_CONFIGS[fleetKey]?.ships[ship.type] || SHIP_IMAGES[ship.type] || '/images/ships/modern/destroyer.png';

            const leftPx = 24 + minCol * 32;
            const topPx = minRow * 32;
            const widthPx = spanCols * 32;
            const heightPx = spanRows * 32;

            return (
              <div
                key={`placed-ship-${idx}`}
                className="absolute pointer-events-none z-10 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300"
                style={{
                  left: `${leftPx}px`,
                  top: `${topPx}px`,
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                }}
              >
                <div className="relative w-full h-full flex items-center justify-center bg-blue-950/40 rounded border border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.3)] overflow-hidden">
                  {isHorizontal ? (
                    <img
                      src={shipImgSrc}
                      alt={ship.type}
                      className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <img
                      src={shipImgSrc}
                      alt={ship.type}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 max-w-none max-h-none object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none"
                      style={{
                        width: `${heightPx}px`,
                        height: `${widthPx}px`,
                      }}
                      draggable={false}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Sunk Ships Overlay: Render full ship image covering the sunken cells */}
          {sunkShips.map((ship, idx) => {
            if (!ship.positions || ship.positions.length === 0) return null;
            const rows = ship.positions.map(p => p.row);
            const cols = ship.positions.map(p => p.col);
            const minRow = Math.min(...rows);
            const minCol = Math.min(...cols);
            const maxRow = Math.max(...rows);
            const maxCol = Math.max(...cols);
            const spanRows = maxRow - minRow + 1;
            const spanCols = maxCol - minCol + 1;
            const isHorizontal = spanCols >= spanRows;
            const fleetKey = ship.fleet || (isOpponentBoard ? state.opponentFleet : state.myFleet) || 'modern';
            const shipImgSrc = FLEET_CONFIGS[fleetKey]?.ships[ship.type] || SHIP_IMAGES[ship.type] || '/images/ships/modern/destroyer.png';

            // Coordinates in pixels (row label width is 24px = w-6, each cell is 32px)
            const leftPx = 24 + minCol * 32;
            const topPx = minRow * 32;
            const widthPx = spanCols * 32;
            const heightPx = spanRows * 32;

            return (
              <div
                key={`sunk-ship-${idx}`}
                className="absolute pointer-events-none z-30 flex items-center justify-center animate-in fade-in zoom-in-95 duration-500"
                style={{
                  left: `${leftPx}px`,
                  top: `${topPx}px`,
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                }}
              >
                {/* Khung chứa tàu chìm: Phân biệt rõ rệt giữa Tàu Địch (Vàng cam/Lửa thắng lợi) và Tàu Ta (Đỏ hồng/Báo động thiệt hại) */}
                <div className={`relative w-full h-full flex items-center justify-center rounded overflow-hidden ${
                  isOpponentBoard
                    ? 'bg-gradient-to-b from-amber-950/70 via-red-950/80 to-blue-950/90 border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.85)]'
                    : 'bg-gradient-to-b from-rose-950/85 via-slate-950/90 to-blue-950/95 border-2 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.9)] animate-pulse'
                }`}>
                  {/* Ảnh chiến hạm đang chìm với hiệu ứng xoay nghiêng và chìm dần xuống nước */}
                  {isHorizontal ? (
                    <img
                      src={shipImgSrc}
                      alt={ship.type}
                      className={`w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] pointer-events-none ${
                        isOpponentBoard ? 'enemy-ship-sink' : 'friendly-ship-sink'
                      }`}
                      draggable={false}
                    />
                  ) : (
                    <img
                      src={shipImgSrc}
                      alt={ship.type}
                      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 max-w-none max-h-none object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] pointer-events-none ${
                        isOpponentBoard ? 'enemy-ship-sink' : 'friendly-ship-sink'
                      }`}
                      style={{
                        width: `${heightPx}px`,
                        height: `${widthPx}px`,
                      }}
                      draggable={false}
                    />
                  )}

                  {/* Lớp nước biển ngập dâng lên thân tàu khi chìm */}
                  <div className={`absolute inset-x-0 bottom-0 pointer-events-none water-flood-anim z-10 ${
                    isOpponentBoard 
                      ? 'bg-gradient-to-t from-blue-950/90 via-blue-900/60 to-transparent' 
                      : 'bg-gradient-to-t from-slate-950/95 via-blue-950/80 to-transparent'
                  }`} />

                  {/* Bọt khí sủi tăm khi tàu chìm xuống đáy biển */}
                  <div className="absolute bottom-1 left-1/4 w-1.5 h-1.5 bg-cyan-200/90 rounded-full bubble-rise-1 pointer-events-none z-20" />
                  <div className="absolute bottom-1 left-1/2 w-2 h-2 bg-white/80 rounded-full bubble-rise-2 pointer-events-none z-20" />
                  <div className="absolute bottom-1 left-3/4 w-1 h-1 bg-cyan-300/90 rounded-full bubble-rise-3 pointer-events-none z-20" />

                  {/* Lửa cháy và khói chiến trường */}
                  <div className={`absolute inset-0 pointer-events-none animate-pulse z-10 ${
                    isOpponentBoard
                      ? 'bg-gradient-to-t from-amber-600/30 via-red-600/30 to-transparent'
                      : 'bg-gradient-to-t from-rose-900/40 via-red-900/30 to-transparent'
                  }`} />
                  
                  {/* Huy hiệu định danh trạng thái hạ tàu */}
                  {isOpponentBoard ? (
                    <div className="absolute top-0.5 right-0.5 bg-gradient-to-r from-amber-500 to-red-600 text-[8.5px] font-black text-white px-1.5 py-0.5 rounded shadow border border-amber-300 tracking-wider uppercase flex items-center gap-0.5 z-20">
                      <span>🎯</span> DIỆT ĐỊCH
                    </div>
                  ) : (
                    <div className="absolute top-0.5 right-0.5 bg-gradient-to-r from-rose-700 to-red-900 text-[8.5px] font-black text-white px-1.5 py-0.5 rounded shadow border border-rose-400 tracking-wider uppercase animate-bounce flex items-center gap-0.5 z-20">
                      <span>⚠️</span> TÀU TA BỊ HẠ
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status indicator */}
      {isOpponentBoard && (
        <div className="text-center mt-2.5">
          <div className={`inline-block px-3.5 py-1 rounded-full text-xs font-semibold shadow tracking-wide ${
            state.isMyTurn 
              ? 'bg-emerald-500 text-white animate-pulse' 
              : 'bg-slate-600 text-slate-200'
          }`}>
            {state.isMyTurn ? 'Lượt của bạn' : 'Lượt đối thủ'}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
