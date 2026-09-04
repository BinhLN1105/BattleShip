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

export type FleetType = 'modern' | 'vintage' | 'scifi';

export interface FleetConfig {
  id: FleetType;
  name: string;
  commanderName: string;
  commanderTitle: string;
  quote: string;
  description: string;
  commanderAvatar: string;
  commanderFull: string;
  ships: Record<ShipType, string>;
}

export const FLEET_CONFIGS: Record<FleetType, FleetConfig> = {
  modern: {
    id: 'modern',
    name: 'Hạm Đội Hiện Đại',
    commanderName: 'Đô Đốc Vance',
    commanderTitle: 'Tư Lệnh Tác Chiến Tối Tân',
    quote: 'Chiến thuật tàng hình và hỏa lực tên lửa chính xác sẽ thống trị biển cả!',
    description: 'Trang bị tàu chiến tàng hình radar Aegis, tuần dương hạm tên lửa và tàu ngầm hạt nhân hiện đại.',
    commanderAvatar: '/images/characters/commander_modern_avatar.png',
    commanderFull: '/images/characters/commander_modern.png',
    ships: {
      [ShipType.DESTROYER]: '/images/ships/modern/destroyer.png',
      [ShipType.SUBMARINE]: '/images/ships/modern/submarine.png',
      [ShipType.CRUISER]: '/images/ships/modern/cruiser.png',
      [ShipType.BATTLESHIP]: '/images/ships/modern/battleship.png',
    }
  },
  vintage: {
    id: 'vintage',
    name: 'Hạm Đội Cổ Điển',
    commanderName: 'Đại Tướng Sterling',
    commanderTitle: 'Huyền Thoại Hải Chiến Hoàng Gia',
    quote: 'Ý chí sắt thép và những họng pháo đại bác sẽ nghiền nát mọi đối thủ!',
    description: 'Hạm đội thiết giáp kinh điển Thế chiến với thân tàu bọc thép dày và tháp pháo đại bác uy lực.',
    commanderAvatar: '/images/characters/commander_vintage_avatar.png',
    commanderFull: '/images/characters/commander_vintage.png',
    ships: {
      [ShipType.DESTROYER]: '/images/ships/vintage/destroyer.png',
      [ShipType.SUBMARINE]: '/images/ships/vintage/submarine.png',
      [ShipType.CRUISER]: '/images/ships/vintage/cruiser.png',
      [ShipType.BATTLESHIP]: '/images/ships/vintage/battleship.png',
    }
  },
  scifi: {
    id: 'scifi',
    name: 'Hạm Đội Viễn Tưởng',
    commanderName: 'Nữ Đô Đốc Nova',
    commanderTitle: 'Chỉ Huy Quân Đoàn Không Gian',
    quote: 'Năng lượng plasma và pháo chùm ion sẽ thanh trừng vùng biển số hóa!',
    description: 'Hạm đội công nghệ lượng tử tương lai với khiên phản xạ, pháo hạt nhân ion và động cơ phản lực plasma.',
    commanderAvatar: '/images/characters/commander_scifi_avatar.png',
    commanderFull: '/images/characters/commander_scifi.png',
    ships: {
      [ShipType.DESTROYER]: '/images/ships/scifi/destroyer.png',
      [ShipType.SUBMARINE]: '/images/ships/scifi/submarine.png',
      [ShipType.CRUISER]: '/images/ships/scifi/cruiser.png',
      [ShipType.BATTLESHIP]: '/images/ships/scifi/battleship.png',
    }
  }
};

export const SHIP_IMAGES: Record<ShipType, string> = FLEET_CONFIGS.modern.ships;

export interface SunkShip {
  type: ShipType;
  positions: Position[];
  isHorizontal: boolean;
  fleet?: FleetType;
}

export interface SunkEventData {
  type: ShipType;
  fleet: FleetType;
  isEnemy: boolean;
  positions: Position[];
  timestamp: number;
}

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
  message?: string;
}

export interface ShotResultData {
  shooter: string;
  row: number;
  col: number;
  result: 'hit' | 'miss' | 'sunk';
  current_turn: string;
  ship_type?: string;
  ship_sunk?: boolean;
  sunk_ship?: {
    type: string;
    positions: [number, number][];
    fleet?: FleetType;
  };
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
