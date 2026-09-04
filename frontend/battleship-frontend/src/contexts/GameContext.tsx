/**
 * Game Context - Quản lý global state cho Battle Ship Game
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  GameState, 
  GameBoard, 
  Ship, 
  Position, 
  CellState, 
  ChatMessage,
  ShipType,
  SHIP_CONFIGS,
  SunkShip,
  SunkEventData,
  FleetType,
  ConnectionSuccessData,
  QueueJoinedData,
  GameFoundData,
  ShotResultData,
  GameOverData
} from '../types/game';
import { websocketService } from '../services/websocket';
import { audioService } from '../services/audioService';

// Initial game board
const createEmptyBoard = (): CellState[][] => {
  return Array(10).fill(null).map(() => Array(10).fill(CellState.WATER));
};

// Game State Interface
interface GameContextState {
  // Connection
  connectionState: GameState;
  clientId: string | null;
  error: string | null;

  // Player info
  playerName: string;
  opponentName: string;

  // Fleet choice
  selectedFleet: FleetType;
  myFleet: FleetType;
  opponentFleet: FleetType;

  // Queue
  queuePosition: number;

  // Game
  gameState: GameState;
  roomId: string | null;
  isMyTurn: boolean;
  
  // Boards
  myBoard: CellState[][];
  opponentBoard: CellState[][];
  myShips: Ship[];
  mySunkShips: SunkShip[];
  opponentSunkShips: SunkShip[];
  
  // Ship placement
  availableShips: Record<ShipType, number>;
  placedShips: Ship[];
  isPlacingShips: boolean;
  
  // Chat
  chatMessages: ChatMessage[];
  
  // UI
  selectedShipType: ShipType | null;
  hoveredCell: Position | null;
  winner: string | null;
  turnTimeLeft: number;
  latestSunkEvent: SunkEventData | null;
}

// Actions
type GameAction = 
  | { type: 'SET_CONNECTION_STATE'; payload: GameState }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CLIENT_ID'; payload: string }
  | { type: 'SET_PLAYER_NAME'; payload: string }
  | { type: 'SET_SELECTED_FLEET'; payload: FleetType }
  | { type: 'SET_QUEUE_POSITION'; payload: number }
  | { type: 'GAME_FOUND'; payload: GameFoundData }
  | { type: 'START_SHIP_PLACEMENT' }
  | { type: 'PLACE_SHIP'; payload: Ship }
  | { type: 'REMOVE_SHIP'; payload: number }
  | { type: 'SHIPS_PLACEMENT_COMPLETE' }
  | { type: 'GAME_START'; payload: { currentTurn: string } }
  | { type: 'SHOT_RESULT'; payload: ShotResultData }
  | { type: 'GAME_OVER'; payload: GameOverData }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_SELECTED_SHIP_TYPE'; payload: ShipType | null }
  | { type: 'SET_HOVERED_CELL'; payload: Position | null }
  | { type: 'SET_PLAYER_FLEETS'; payload: { myFleet: FleetType; opponentFleet: FleetType } }
  | { type: 'RESET_GAME' }
  | { type: 'RESET_PLACEMENT' }
  | { type: 'SET_ALL_PLACED_SHIPS'; payload: Ship[] }
  | { type: 'GAME_UPDATE'; payload: any }
  | { type: 'TICK_TIMER' };

// Initial state
const savedClientId = typeof window !== 'undefined' ? localStorage.getItem('battleship_client_id') : null;
const initialState: GameContextState = {
  connectionState: GameState.DISCONNECTED,
  clientId: savedClientId || null,
  error: null,
  playerName: '',
  opponentName: '',
  selectedFleet: 'modern',
  myFleet: 'modern',
  opponentFleet: 'modern',
  queuePosition: 0,
  gameState: GameState.DISCONNECTED,
  roomId: null,
  isMyTurn: false,
  myBoard: createEmptyBoard(),
  opponentBoard: createEmptyBoard(),
  myShips: [],
  mySunkShips: [],
  opponentSunkShips: [],
  availableShips: {
    [ShipType.DESTROYER]: SHIP_CONFIGS[ShipType.DESTROYER].count,
    [ShipType.SUBMARINE]: SHIP_CONFIGS[ShipType.SUBMARINE].count,
    [ShipType.CRUISER]: SHIP_CONFIGS[ShipType.CRUISER].count,
    [ShipType.BATTLESHIP]: SHIP_CONFIGS[ShipType.BATTLESHIP].count,
  },
  placedShips: [],
  isPlacingShips: false,
  chatMessages: [],
  selectedShipType: null,
  hoveredCell: null,
  winner: null,
  turnTimeLeft: 30,
  latestSunkEvent: null,
};

// Reducer
const gameReducer = (state: GameContextState, action: GameAction): GameContextState => {
  switch (action.type) {
    case 'SET_CONNECTION_STATE':
      return { ...state, connectionState: action.payload };
      
    case 'SET_SELECTED_FLEET':
      return { ...state, selectedFleet: action.payload, myFleet: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload };
      
    case 'SET_CLIENT_ID':
      return { ...state, clientId: action.payload };
      
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.payload };
      
    case 'SET_QUEUE_POSITION':
      return { ...state, queuePosition: action.payload };
      
    case 'GAME_FOUND':
      return { 
        ...state, 
        gameState: GameState.GAME_FOUND,
        roomId: action.payload.room_id || state.roomId,
        opponentName: action.payload.opponent,
        isMyTurn: action.payload.your_turn,
        turnTimeLeft: 30
      };
      
    case 'START_SHIP_PLACEMENT':
      return { 
        ...state, 
        gameState: GameState.PLACING_SHIPS,
        isPlacingShips: true 
      };
      
    case 'PLACE_SHIP':
      const newShip = action.payload;
      const newAvailableShips = { ...state.availableShips };
      newAvailableShips[newShip.type]--;
      
      // Update board
      const newBoard = state.myBoard.map(row => [...row]);
      newShip.positions.forEach(pos => {
        newBoard[pos.row][pos.col] = CellState.SHIP;
      });
      
      return {
        ...state,
        placedShips: [...state.placedShips, newShip],
        availableShips: newAvailableShips,
        myBoard: newBoard,
        myShips: [...state.myShips, newShip]
      };
      
    case 'REMOVE_SHIP':
      const shipIndex = action.payload;
      const removedShip = state.placedShips[shipIndex];
      const updatedAvailableShips = { ...state.availableShips };
      updatedAvailableShips[removedShip.type]++;
      
      // Update board
      const updatedBoard = state.myBoard.map(row => [...row]);
      removedShip.positions.forEach(pos => {
        updatedBoard[pos.row][pos.col] = CellState.WATER;
      });
      
      return {
        ...state,
        placedShips: state.placedShips.filter((_, i) => i !== shipIndex),
        availableShips: updatedAvailableShips,
        myBoard: updatedBoard,
        myShips: state.myShips.filter((_, i) => i !== shipIndex)
      };

    case 'RESET_PLACEMENT':
      return {
        ...state,
        placedShips: [],
        availableShips: {
          [ShipType.DESTROYER]: SHIP_CONFIGS[ShipType.DESTROYER].count,
          [ShipType.SUBMARINE]: SHIP_CONFIGS[ShipType.SUBMARINE].count,
          [ShipType.CRUISER]: SHIP_CONFIGS[ShipType.CRUISER].count,
          [ShipType.BATTLESHIP]: SHIP_CONFIGS[ShipType.BATTLESHIP].count,
        },
        myBoard: createEmptyBoard(),
        myShips: []
      };

    case 'SET_ALL_PLACED_SHIPS': {
      const allShips = action.payload;
      const allShipsBoard = createEmptyBoard();
      allShips.forEach(ship => {
        ship.positions.forEach(pos => {
          allShipsBoard[pos.row][pos.col] = CellState.SHIP;
        });
      });
      return {
        ...state,
        placedShips: allShips,
        availableShips: {
          [ShipType.DESTROYER]: 0,
          [ShipType.SUBMARINE]: 0,
          [ShipType.CRUISER]: 0,
          [ShipType.BATTLESHIP]: 0,
        },
        myBoard: allShipsBoard,
        myShips: allShips
      };
    }
      
    case 'SHIPS_PLACEMENT_COMPLETE':
      return { 
        ...state, 
        isPlacingShips: false,
        gameState: GameState.PLAYING 
      };
      
    case 'GAME_START':
      return { 
        ...state, 
        gameState: GameState.PLAYING,
        isMyTurn: action.payload.currentTurn === state.clientId,
        roomId: 'room_id' in action.payload ? String((action.payload as any).room_id) || state.roomId : state.roomId
      };
      
    case 'SHOT_RESULT': {
      const { row, col, result, current_turn, shooter } = action.payload;
      const isMyShot = shooter === state.clientId;
      
      // Update appropriate board
      const boardToUpdate = isMyShot ? state.opponentBoard : state.myBoard;
      const updatedShotBoard = boardToUpdate.map((boardRow, r) =>
        boardRow.map((cell, c) => {
          if (r === row && c === col) {
            return result === 'hit' || result === 'sunk' ? CellState.HIT : CellState.MISS;
          }
          return cell;
        })
      );

      let mySunkShips = state.mySunkShips;
      let opponentSunkShips = state.opponentSunkShips;
      let latestSunkEvent = state.latestSunkEvent;
      if (result === 'sunk' && action.payload.sunk_ship) {
        const rawPositions = action.payload.sunk_ship.positions || [];
        const positions: Position[] = rawPositions.map((p: any) => ({ row: p[0], col: p[1] }));
        const isHorizontal = positions.length > 1 ? positions[0].row === positions[1].row : true;
        const newSunkShip: SunkShip = {
          type: action.payload.sunk_ship.type as ShipType,
          positions,
          isHorizontal,
          fleet: action.payload.sunk_ship.fleet || (isMyShot ? state.opponentFleet : state.myFleet)
        };
        latestSunkEvent = {
          type: newSunkShip.type,
          fleet: newSunkShip.fleet || (isMyShot ? state.opponentFleet : state.myFleet),
          isEnemy: isMyShot,
          positions,
          timestamp: Date.now()
        };
        if (isMyShot) {
          const exists = opponentSunkShips.some(s =>
            s.positions.length === positions.length &&
            s.positions.every((p, idx) => p.row === positions[idx]?.row && p.col === positions[idx]?.col)
          );
          if (!exists) opponentSunkShips = [...opponentSunkShips, newSunkShip];
        } else {
          const exists = mySunkShips.some(s =>
            s.positions.length === positions.length &&
            s.positions.every((p, idx) => p.row === positions[idx]?.row && p.col === positions[idx]?.col)
          );
          if (!exists) mySunkShips = [...mySunkShips, newSunkShip];
        }
      }
      
      return {
        ...state,
        ...(isMyShot ? { opponentBoard: updatedShotBoard } : { myBoard: updatedShotBoard }),
        mySunkShips,
        opponentSunkShips,
        latestSunkEvent,
        isMyTurn: current_turn === state.clientId
      };
    }
      
    case 'GAME_OVER':
      return { 
        ...state, 
        gameState: GameState.FINISHED,
        winner: action.payload.winner,
        isMyTurn: false,
        roomId: 'room_id' in action.payload ? String((action.payload as any).room_id) || state.roomId : state.roomId
      };
      
    case 'ADD_CHAT_MESSAGE':
      return { 
        ...state, 
        chatMessages: [...state.chatMessages, action.payload] 
      };
      
    case 'SET_SELECTED_SHIP_TYPE':
      return { ...state, selectedShipType: action.payload };
      
    case 'SET_PLAYER_FLEETS':
      return {
        ...state,
        myFleet: action.payload.myFleet,
        opponentFleet: action.payload.opponentFleet
      };

    case 'SET_HOVERED_CELL':
      return { ...state, hoveredCell: action.payload };
      
    case 'RESET_GAME':
      return {
        ...initialState,
        connectionState: state.connectionState,
        clientId: state.clientId,
        playerName: state.playerName,
        selectedFleet: state.selectedFleet,
        myFleet: state.selectedFleet,
        opponentFleet: 'modern',
        mySunkShips: [],
        opponentSunkShips: [],
        latestSunkEvent: null,
        turnTimeLeft: 30
      };
      
    case 'TICK_TIMER':
      return {
        ...state,
        turnTimeLeft: Math.max(0, state.turnTimeLeft - 1)
      };
      
    case 'GAME_UPDATE': {
      // Cập nhật bảng khi có shot mới
      let myBoard = state.myBoard;
      let opponentBoard = state.opponentBoard;
      let mySunkShips = state.mySunkShips;
      let opponentSunkShips = state.opponentSunkShips;

      if (action.payload.shot) {
        const { row, col } = action.payload.shot;
        const isMyShot = action.payload.by === state.clientId;
        if (isMyShot) {
          // Cập nhật bảng đối thủ
          opponentBoard = state.opponentBoard.map((r, rIdx) =>
            r.map((cell, cIdx) => (rIdx === row && cIdx === col
              ? (action.payload.hit ? CellState.HIT : CellState.MISS)
              : cell))
          );
        } else {
          // Cập nhật bảng của mình
          myBoard = state.myBoard.map((r, rIdx) =>
            r.map((cell, cIdx) => (rIdx === row && cIdx === col
              ? (action.payload.hit ? CellState.HIT : CellState.MISS)
              : cell))
          );
        }
      }

      // Cập nhật tàu chìm nếu có
      let latestSunkEvent = state.latestSunkEvent;
      if (action.payload.sunk && action.payload.sunk_ship) {
        const rawPositions = action.payload.sunk_ship.positions || [];
        const positions: Position[] = rawPositions.map((p: any) => ({ row: p[0], col: p[1] }));
        const isHorizontal = positions.length > 1 ? positions[0].row === positions[1].row : true;
        const isMyShot = action.payload.by === state.clientId;
        const newSunkShip: SunkShip = {
          type: action.payload.sunk_ship.type as ShipType,
          positions,
          isHorizontal,
          fleet: action.payload.sunk_ship.fleet || (isMyShot ? state.opponentFleet : state.myFleet)
        };
        latestSunkEvent = {
          type: newSunkShip.type,
          fleet: newSunkShip.fleet || (isMyShot ? state.opponentFleet : state.myFleet),
          isEnemy: isMyShot,
          positions,
          timestamp: Date.now()
        };
        if (isMyShot) {
          const exists = opponentSunkShips.some(s =>
            s.positions.length === positions.length &&
            s.positions.every((p, idx) => p.row === positions[idx]?.row && p.col === positions[idx]?.col)
          );
          if (!exists) opponentSunkShips = [...opponentSunkShips, newSunkShip];
        } else {
          const exists = mySunkShips.some(s =>
            s.positions.length === positions.length &&
            s.positions.every((p, idx) => p.row === positions[idx]?.row && p.col === positions[idx]?.col)
          );
          if (!exists) mySunkShips = [...mySunkShips, newSunkShip];
        }
      }

      // Lấy timeout từ payload nếu có
      const turnTimeLeft = typeof action.payload.timeout === 'number' ? action.payload.timeout : state.turnTimeLeft;
      // Cập nhật opponentName nếu có player_names
      let opponentName = state.opponentName;
      if (action.payload.player_names && state.clientId) {
        const names = action.payload.player_names;
        opponentName = Object.entries(names)
          .filter(([id]) => id !== state.clientId)
          .map(([_, name]) => String(name))[0] || state.opponentName;
      }
      // Cập nhật player_fleets nếu có
      let myFleet = state.myFleet;
      let opponentFleet = state.opponentFleet;
      if (action.payload.player_fleets && state.clientId) {
        myFleet = (action.payload.player_fleets[state.clientId] as FleetType) || state.myFleet;
        const oppId = Object.keys(action.payload.player_fleets).find(id => id !== state.clientId);
        if (oppId) {
          opponentFleet = (action.payload.player_fleets[oppId] as FleetType) || state.opponentFleet;
        }
      }
      return {
        ...state,
        gameState: action.payload.status === 'playing' ? GameState.PLAYING : state.gameState,
        isMyTurn: action.payload.turn === action.payload.clientId,
        myBoard,
        opponentBoard,
        mySunkShips,
        opponentSunkShips,
        latestSunkEvent,
        turnTimeLeft,
        opponentName,
        myFleet,
        opponentFleet,
        roomId: action.payload.room_id || state.roomId,
      };
    }
      
    default:
      return state;
  }
};

// Context
const GameContext = createContext<{
  state: GameContextState;
  dispatch: React.Dispatch<GameAction>;
  actions: {
    connect: () => Promise<void>;
    joinQueue: () => void;
    leaveQueue: () => void;
    placeShip: (shipType: ShipType, startPos: Position, isHorizontal: boolean) => boolean;
    removeShip: (shipIndex: number) => void;
    resetPlacement: () => void;
    setAllPlacedShips: (ships: Ship[]) => void;
    completeShipPlacement: () => void;
    fireShot: (row: number, col: number) => void;
    sendChatMessage: (message: string) => void;
    surrender: () => void;
    resetGame: () => void;
    setSelectedFleet: (fleet: FleetType) => void;
  };
} | null>(null);

// Provider
export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Ref để luôn lấy clientId mới nhất trong handler
  const clientIdRef = React.useRef(state.clientId);
  React.useEffect(() => {
    clientIdRef.current = state.clientId;
  }, [state.clientId]);

  // WebSocket event handlers
  useEffect(() => {
    // Connection success
    websocketService.on('connection_success', (data: ConnectionSuccessData) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('battleship_client_id', data.client_id);
      }
      dispatch({ type: 'SET_CLIENT_ID', payload: data.client_id });
      dispatch({ type: 'SET_CONNECTION_STATE', payload: GameState.CONNECTED });
    });

    // Queue joined
    websocketService.on('queue_joined', (data: QueueJoinedData) => {
      dispatch({ type: 'SET_QUEUE_POSITION', payload: data.position });
      dispatch({ type: 'SET_CONNECTION_STATE', payload: GameState.IN_QUEUE });
    });

    // Game found
    websocketService.on('game_found', (data: GameFoundData) => {
      dispatch({ type: 'GAME_FOUND', payload: data });
    });

    // Ships placed
    websocketService.on('ships_placed', () => {
      dispatch({ type: 'SHIPS_PLACEMENT_COMPLETE' });
      audioService.playGameSound('turn');
    });

    // Game start
    websocketService.on('game_start', (data: { current_turn: string }) => {
      dispatch({ type: 'GAME_START', payload: { currentTurn: data.current_turn } });
      audioService.playGameSound('turn');
    });

    // Shot result
    websocketService.on('shot_result', (data: ShotResultData) => {
      dispatch({ type: 'SHOT_RESULT', payload: data });
      
      // Play appropriate sound
      if (data.result === 'hit') {
        audioService.playGameSound('hit');
      } else if (data.result === 'miss') {
        audioService.playGameSound('miss');
      } else if (data.result === 'sunk') {
        audioService.playGameSound('sunk');
      }
    });

    // Game over
    websocketService.on('game_over', (data: GameOverData) => {
      dispatch({ type: 'GAME_OVER', payload: data });
      
      // Play win/lose sound
      const isWinner = data.winner === state.clientId;
      audioService.playGameSound(isWinner ? 'win' : 'lose');
    });

    // Chat message
    websocketService.on('chat_message', (data: { sender: string; message: string; timestamp: number }) => {
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: data });
      
      // Play chat sound only for messages from other players
      if (data.sender !== state.playerName) {
        audioService.playGameSound('chat');
      }
    });

    // Error
    websocketService.on('error', (data: { message: string }) => {
      dispatch({ type: 'SET_ERROR', payload: data.message });
    });

    // Thêm handler cho start_game từ backend
    websocketService.on('start_game', (data: any) => {
      // Lưu thông tin đối thủ, game_id và đội hình hạm đội
      dispatch({ type: 'SET_CONNECTION_STATE', payload: GameState.GAME_FOUND });
      if (data.opponent) {
        dispatch({
          type: 'GAME_FOUND',
          payload: {
            opponent: data.opponent,
            your_turn: false,
            room_id: data.room_id || data.game_id,
            message: data.message || 'Đã ghép trận! Bắt đầu đặt tàu.'
          }
        });
      }
      if (data.player_fleets && clientIdRef.current) {
        const myF = (data.player_fleets[clientIdRef.current] as FleetType) || 'modern';
        const oppId = Object.keys(data.player_fleets).find(id => id !== clientIdRef.current);
        const oppF = oppId ? ((data.player_fleets[oppId] as FleetType) || 'modern') : 'modern';
        dispatch({ type: 'SET_PLAYER_FLEETS', payload: { myFleet: myF, opponentFleet: oppF } });
      }
    });

    // Thêm handler cho game_update từ backend
    websocketService.on('game_update', (data: any) => {
      dispatch({ type: 'GAME_UPDATE', payload: { ...data, clientId: clientIdRef.current } });
    });

    return () => {
      // Cleanup listeners when component unmounts
      websocketService.disconnect();
    };
  }, []);

  // Đếm ngược thời gian lượt bắn
  useEffect(() => {
    if (state.gameState === GameState.PLAYING && state.turnTimeLeft > 0) {
      const timer = setInterval(() => {
        dispatch({ type: 'TICK_TIMER' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.gameState, state.turnTimeLeft]);

  // Actions
  const actions = {
    connect: async () => {
      try {
        dispatch({ type: 'SET_CONNECTION_STATE', payload: GameState.CONNECTING });
        await websocketService.connect();
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Không thể kết nối đến server' });
        dispatch({ type: 'SET_CONNECTION_STATE', payload: GameState.DISCONNECTED });
      }
    },

    joinQueue: () => {
      if (state.playerName.trim()) {
        websocketService.joinQueue(state.playerName, state.selectedFleet);
      }
    },

    leaveQueue: () => {
      websocketService.leaveQueue();
    },

    setSelectedFleet: (fleet: FleetType) => {
      dispatch({ type: 'SET_SELECTED_FLEET', payload: fleet });
    },

    placeShip: (shipType: ShipType, startPos: Position, isHorizontal: boolean): boolean => {
      // Validation logic
      const shipSize = SHIP_CONFIGS[shipType].size;
      
      // Check if we have ships of this type available
      if (state.availableShips[shipType] <= 0) {
        return false;
      }

      // Calculate positions
      const positions: Position[] = [];
      for (let i = 0; i < shipSize; i++) {
        const pos = isHorizontal 
          ? { row: startPos.row, col: startPos.col + i }
          : { row: startPos.row + i, col: startPos.col };
        
        // Check boundaries
        if (pos.row >= 10 || pos.col >= 10 || pos.row < 0 || pos.col < 0) {
          return false;
        }
        
        // Check if cell is already occupied
        if (state.myBoard[pos.row][pos.col] !== CellState.WATER) {
          return false;
        }
        
        positions.push(pos);
      }

      // Place ship
      const newShip: Ship = {
        type: shipType,
        positions,
        isHorizontal
      };

      dispatch({ type: 'PLACE_SHIP', payload: newShip });
      audioService.playGameSound('place');
      return true;
    },

    removeShip: (shipIndex: number) => {
      dispatch({ type: 'REMOVE_SHIP', payload: shipIndex });
    },

    resetPlacement: () => {
      dispatch({ type: 'RESET_PLACEMENT' });
    },

    setAllPlacedShips: (ships: Ship[]) => {
      dispatch({ type: 'SET_ALL_PLACED_SHIPS', payload: ships });
      audioService.playGameSound('place');
    },

    completeShipPlacement: () => {
      // Kiểm tra mỗi loại tàu phải đặt đúng số lượng quy định trong SHIP_CONFIGS
      const typeCounts: Record<string, number> = {};
      state.placedShips.forEach(ship => {
        typeCounts[ship.type] = (typeCounts[ship.type] || 0) + 1;
      });
      const allTypes = Object.keys(SHIP_CONFIGS);
      const wrong = allTypes.filter(type => typeCounts[type] !== SHIP_CONFIGS[type as ShipType].count);
      if (wrong.length > 0) {
        dispatch({ type: 'SET_ERROR', payload: 'Bạn phải đặt đúng số lượng mỗi loại tàu theo quy định!' });
        return;
      }
      websocketService.placeShips(state.placedShips);
    },

    fireShot: (row: number, col: number) => {
      if (state.isMyTurn && state.gameState === GameState.PLAYING) {
        websocketService.fireShot(row, col);
      }
    },

    sendChatMessage: (message: string) => {
      websocketService.sendChatMessage(message);
    },

    surrender: () => {
      websocketService.surrender();
    },

    resetGame: () => {
      dispatch({ type: 'RESET_GAME' });
    }
  };

  return (
    <GameContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </GameContext.Provider>
  );
};

// Hook
export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
