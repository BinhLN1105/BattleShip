/**
 * Types định nghĩa cho Battle Ship Game
 */

export interface Position {
  row: number;
  col: number;
}

export interface Ship {
  type: ShipType;
  positions: Position[];
  hits?: Set<string>;
  isHorizontal: boolean;
}

export interface ShipConfig {
  name: string;
  size: number;
  count: number;
}

export enum ShipType {
  DESTROYER = 'Destroyer',
  SUBMARINE = 'Submarine', 
  CRUISER = 'Cruiser',
  BATTLESHIP = 'Battleship'
}

export const SHIP_CONFIGS: Record<ShipType, ShipConfig> = {
  [ShipType.DESTROYER]: { name: 'Destroyer', size: 2, count: 1 },
  [ShipType.SUBMARINE]: { name: 'Submarine', size: 3, count: 2 },
  [ShipType.CRUISER]: { name: 'Cruiser', size: 4, count: 1 },
  [ShipType.BATTLESHIP]: { name: 'Battleship', size: 5, count: 1 }
};

export enum CellState {
  WATER = 'water',
  SHIP = 'ship',
  HIT = 'hit',
  MISS = 'miss'
}

export enum GameState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  IN_QUEUE = 'in_queue',
  GAME_FOUND = 'game_found',
  PLACING_SHIPS = 'placing_ships',
  PLAYING = 'playing',
  FINISHED = 'finished',
  DISCONNECTED = 'disconnected'
}

export interface GameBoard {
  cells: CellState[][];
  ships: Ship[];
}

export interface Player {
  id: string;
  name: string;
  board: GameBoard;
  isReady: boolean;
}

export interface GameRoom {
  id: string;
  players: Player[];
  currentTurn: string;
  gameState: GameState;
  winner?: string;
}

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

// Message types từ protocol
export interface Message {
  type: string;
  data: any;
  timestamp?: number;
}

export interface ConnectionSuccessData {
  client_id: string;
  message: string;
  server_version: string;
}

export interface QueueJoinedData {
  position: number;
  message: string;
}

export interface GameFoundData {
  room_id: string;
  opponent: string;
  your_turn: boolean;
  message: string;
}

export interface ShotResultData {
  shooter: string;
  row: number;
  col: number;
  result: 'hit' | 'miss' | 'sunk';
  current_turn: string;
  ship_type?: string;
  ship_sunk?: boolean;
}

export interface GameOverData {
  winner: string;
  winner_name: string;
  message: string;
  reason?: string;
}

export interface GameStateData {
  room_id: string;
  game_state: string;
  current_turn: string;
  your_board: CellState[][];
  opponent_board: CellState[][];
  your_ships: any;
  opponent_ships: any;
  player_names: Record<string, string>;
}

// Audio và effects
export interface SoundEffect {
  hit: HTMLAudioElement;
  miss: HTMLAudioElement;
  sunk: HTMLAudioElement;
  place: HTMLAudioElement;
  win: HTMLAudioElement;
  lose: HTMLAudioElement;
}

// UI State
export interface UIState {
  isDragging: boolean;
  draggedShip?: Ship;
  hoveredCell?: Position;
  selectedShip?: ShipType;
  showChat: boolean;
  volume: number;
}
