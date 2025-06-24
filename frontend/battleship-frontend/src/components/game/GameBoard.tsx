/**
 * GameBoard Component - Hiển thị và xử lý tương tác với bảng game
 */

import React from 'react';
import { CellState, Position } from '../../types/game';
import { useGame } from '../../contexts/GameContext';

interface GameBoardProps {
  board: CellState[][];
  isOpponentBoard?: boolean;
  canShoot?: boolean;
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (row: number, col: number) => void;
  onCellLeave?: () => void;
  className?: string;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  isOpponentBoard = false,
  canShoot = false,
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
  const getCellClasses = (row: number, col: number, cellState: CellState): string => {
    const baseClasses = 'w-8 h-8 border border-blue-300 transition-all duration-200 relative overflow-hidden';
    
    let stateClasses = '';
    switch (cellState) {
      case CellState.WATER:
        stateClasses = 'bg-blue-100 hover:bg-blue-200';
        break;
      case CellState.SHIP:
        stateClasses = isOpponentBoard ? 'bg-blue-100' : 'bg-gray-600 border-gray-800';
        break;
      case CellState.HIT:
        stateClasses = 'bg-red-600 border-red-800';
        break;
      case CellState.MISS:
        stateClasses = 'bg-blue-400 border-blue-600';
        break;
    }

    // Cursor styles
    const cursorClasses = canShoot && isOpponentBoard && state.isMyTurn && cellState === CellState.WATER
      ? 'cursor-crosshair'
      : 'cursor-default';

    // Hover effects for opponent board
    const hoverClasses = isOpponentBoard && canShoot && state.isMyTurn && cellState === CellState.WATER
      ? 'hover:ring-2 hover:ring-red-400 hover:ring-opacity-50'
      : '';

    // Không cho click lại các ô đã bắn
    const disabledClasses = (cellState === CellState.HIT || cellState === CellState.MISS) ? 'opacity-80 pointer-events-none' : '';

    return `${baseClasses} ${stateClasses} ${cursorClasses} ${hoverClasses} ${disabledClasses}`;
  };

  // Render cell content (icons for hit/miss)
  const renderCellContent = (cellState: CellState): JSX.Element | null => {
    switch (cellState) {
      case CellState.HIT:
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full opacity-80"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-xs font-bold">×</span>
            </div>
          </div>
        );
      case CellState.MISS:
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full opacity-60"></div>
          </div>
        );
      case CellState.SHIP:
        return !isOpponentBoard ? (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-500 to-gray-700"></div>
        ) : null;
      default:
        return null;
    }
  };

  // Row and column labels
  const rowLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  return (
    <div className={`inline-block ${className}`}>
      {/* Title */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-white">
          {isOpponentBoard ? `Bảng của ${state.opponentName}` : `Bảng của bạn`}
        </h3>
        {isOpponentBoard && canShoot && (
          <p className="text-sm text-blue-200 mt-1">
            {state.isMyTurn ? 'Nhấp để bắn!' : 'Đợi lượt đối thủ...'}
          </p>
        )}
      </div>

      {/* Board with labels */}
      <div className="bg-blue-800 p-4 rounded-lg shadow-lg">
        {/* Column labels */}
        <div className="flex mb-1">
          <div className="w-6"></div> {/* Empty corner */}
          {colLabels.map((label, index) => (
            <div key={index} className="w-8 h-6 flex items-center justify-center text-white font-semibold text-sm">
              {label}
            </div>
          ))}
        </div>

        {/* Rows with row labels and cells */}
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {/* Row label */}
            <div className="w-6 h-8 flex items-center justify-center text-white font-semibold text-sm">
              {rowLabels[rowIndex]}
            </div>
            
            {/* Cells */}
            {row.map((cellState, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={getCellClasses(rowIndex, colIndex, cellState)}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                onMouseLeave={onCellLeave}
                disabled={!canShoot && isOpponentBoard}
                title={`${colLabels[colIndex]}${rowLabels[rowIndex]}`}
              >
                {renderCellContent(cellState)}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Status indicator */}
      {isOpponentBoard && (
        <div className="text-center mt-2">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            state.isMyTurn 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-500 text-white'
          }`}>
            {state.isMyTurn ? 'Lượt của bạn' : 'Lượt đối thủ'}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
