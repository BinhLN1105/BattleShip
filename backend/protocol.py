"""
Communication Protocol cho Battle Ship Game
Định nghĩa các message types và helper functions
"""

import json
from enum import Enum
from typing import Dict, Any, Optional

class MessageType:
    """Định nghĩa các loại message"""
    
    # Connection messages
    CONNECTION_SUCCESS = "connection_success"
    DISCONNECT = "disconnect"
    ERROR = "error"
    
    # Queue messages  
    JOIN_QUEUE = "join_queue"
    LEAVE_QUEUE = "leave_queue"
    QUEUE_JOINED = "queue_joined"
    QUEUE_LEFT = "queue_left"
    GAME_FOUND = "game_found"
    
    # Game setup messages
    PLACE_SHIPS = "place_ships"
    SHIPS_PLACED = "ships_placed"
    GAME_START = "game_start"
    
    # Gameplay messages
    FIRE_SHOT = "fire_shot"
    SHOT_RESULT = "shot_result"
    GAME_OVER = "game_over"
    SURRENDER = "surrender"
    
    # Communication messages
    CHAT_MESSAGE = "chat_message"
    OPPONENT_DISCONNECTED = "opponent_disconnected"
    
    # Game state messages
    GAME_STATE = "game_state"
    BOARD_UPDATE = "board_update"

def create_message(message_type: str, data: Dict[str, Any] = {}) -> Dict[str, Any]:
    """Tạo message theo protocol"""
    return {
        'type': message_type,
        'data': data,
        'timestamp': None  # Server sẽ set timestamp
    }

def parse_message(message_str: str) -> Optional[Dict[str, Any]]:
    """Parse message từ string JSON"""
    try:
        message = json.loads(message_str)
        if not isinstance(message, dict) or 'type' not in message:
            return None
        return message
    except (json.JSONDecodeError, ValueError):
        return None

def validate_join_queue_data(data: Dict[str, Any]) -> bool:
    """Validate dữ liệu join queue"""
    if not isinstance(data, dict):
        return False
    
    player_name = data.get('player_name', '')
    if not isinstance(player_name, str) or len(player_name.strip()) == 0:
        return False
        
    return True

def validate_place_ships_data(data: Dict[str, Any]) -> bool:
    """Validate dữ liệu đặt tàu"""
    if not isinstance(data, dict):
        return False
        
    ships = data.get('ships', [])
    if not isinstance(ships, list):
        return False
        
    # Kiểm tra từng tàu
    for ship in ships:
        if not isinstance(ship, dict):
            return False
            
        ship_type = ship.get('type')
        positions = ship.get('positions', [])
        
        if not isinstance(ship_type, str) or not isinstance(positions, list):
            return False
            
        # Kiểm tra positions
        for pos in positions:
            if (not isinstance(pos, list) or len(pos) != 2 or
                not isinstance(pos[0], int) or not isinstance(pos[1], int)):
                return False
                
    return True

def validate_fire_shot_data(data: Dict[str, Any]) -> bool:
    """Validate dữ liệu bắn"""
    if not isinstance(data, dict):
        return False
        
    row = data.get('row')
    col = data.get('col')
    
    if (not isinstance(row, int) or not isinstance(col, int) or
        row < 0 or row >= 10 or col < 0 or col >= 10):
        return False
        
    return True

def validate_chat_message_data(data: Dict[str, Any]) -> bool:
    """Validate dữ liệu chat"""
    if not isinstance(data, dict):
        return False
        
    message = data.get('message', '')
    if not isinstance(message, str) or len(message.strip()) == 0:
        return False
        
    return True

class ProtocolError(Exception):
    """Exception cho lỗi protocol"""
    pass

class MessageBuilder:
    """Helper class để build các message phức tạp"""
    
    @staticmethod
    def connection_success(client_id: str) -> Dict[str, Any]:
        """Message kết nối thành công"""
        return create_message(MessageType.CONNECTION_SUCCESS, {
            'client_id': client_id,
            'message': 'Kết nối thành công đến Battle Ship Server!',
            'server_version': '1.0.0'
        })
    
    @staticmethod
    def error(message: str, error_code: str = "") -> Dict[str, Any]:
        """Message lỗi"""
        data = {'message': message}
        if error_code:
            data['error_code'] = error_code
        return create_message(MessageType.ERROR, data)
    
    @staticmethod
    def queue_joined(position: int) -> Dict[str, Any]:
        """Message tham gia queue thành công"""
        return create_message(MessageType.QUEUE_JOINED, {
            'position': position,
            'message': f'Đã tham gia queue. Vị trí: {position}'
        })
    
    @staticmethod
    def game_found(room_id: str, opponent_name: str, is_first_player: bool) -> Dict[str, Any]:
        """Message tìm thấy game"""
        return create_message(MessageType.GAME_FOUND, {
            'room_id': room_id,
            'opponent': opponent_name,
            'your_turn': is_first_player,
            'message': f'Đã tìm thấy đối thủ: {opponent_name}'
        })
    
    @staticmethod
    def ships_placed() -> Dict[str, Any]:
        """Message đặt tàu thành công"""
        return create_message(MessageType.SHIPS_PLACED, {
            'message': 'Đã đặt tàu thành công!'
        })
    
    @staticmethod
    def game_start(current_player_id: str) -> Dict[str, Any]:
        """Message bắt đầu game"""
        return create_message(MessageType.GAME_START, {
            'message': 'Game bắt đầu! Hãy bắn vào bảng của đối thủ!',
            'current_turn': current_player_id
        })
    
    @staticmethod
    def shot_result(
        shooter_id: str,
        row: int,
        col: int,
        result: str,
        current_turn: str,
        ship_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Message kết quả bắn"""
        data = {
            'shooter': shooter_id,
            'row': row,
            'col': col,
            'result': result,
            'current_turn': current_turn
        }
        
        if ship_info:
            data.update(ship_info)
            
        return create_message(MessageType.SHOT_RESULT, data)
    
    @staticmethod
    def game_over(winner_id: str, winner_name: str, reason: str = "") -> Dict[str, Any]:
        """Message kết thúc game"""
        data = {
            'winner': winner_id,
            'winner_name': winner_name,
            'message': f'{winner_name} đã thắng!'
        }
        
        if reason:
            data['reason'] = reason
            data['message'] = f'{winner_name} đã thắng! ({reason})'
            
        return create_message(MessageType.GAME_OVER, data)
    
    @staticmethod
    def chat_message(sender_name: str, message: str, timestamp: int) -> Dict[str, Any]:
        """Message chat"""
        return create_message(MessageType.CHAT_MESSAGE, {
            'sender': sender_name,
            'message': message,
            'timestamp': timestamp
        })
    
    @staticmethod
    def opponent_disconnected(opponent_name: str) -> Dict[str, Any]:
        """Message đối thủ ngắt kết nối"""
        return create_message(MessageType.OPPONENT_DISCONNECTED, {
            'message': f'{opponent_name} đã ngắt kết nối. Bạn thắng!',
            'reason': 'opponent_disconnected'
        })
    
    @staticmethod
    def game_state(room_id: str, game_state: str, current_turn: str,
                  your_board: list, opponent_board: list,
                  your_ships: dict, opponent_ships: dict,
                  player_names: dict) -> Dict[str, Any]:
        """Message trạng thái game"""
        return create_message(MessageType.GAME_STATE, {
            'room_id': room_id,
            'game_state': game_state,
            'current_turn': current_turn,
            'your_board': your_board,
            'opponent_board': opponent_board,
            'your_ships': your_ships,
            'opponent_ships': opponent_ships,
            'player_names': player_names
        })

# Protocol constants
PROTOCOL_VERSION = "1.0.0"
MAX_MESSAGE_SIZE = 4096
MAX_PLAYER_NAME_LENGTH = 50
MAX_CHAT_MESSAGE_LENGTH = 500

# Ship configuration
SHIP_CONFIG = {
    'Destroyer': {'size': 2, 'count': 4},
    'Submarine': {'size': 3, 'count': 3}, 
    'Cruiser': {'size': 4, 'count': 2},
    'Battleship': {'size': 5, 'count': 1}
}

BOARD_SIZE = 10

def get_protocol_info() -> Dict[str, Any]:
    """Lấy thông tin protocol"""
    return {
        'version': PROTOCOL_VERSION,
        'max_message_size': MAX_MESSAGE_SIZE,
        'max_player_name_length': MAX_PLAYER_NAME_LENGTH,
        'max_chat_message_length': MAX_CHAT_MESSAGE_LENGTH,
        'board_size': BOARD_SIZE,
        'ship_config': SHIP_CONFIG,
        'message_types': {
            attr: getattr(MessageType, attr)
            for attr in dir(MessageType)
            if not attr.startswith('_')
        }
    }
