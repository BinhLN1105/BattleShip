"""
Battle Ship Game Logic
Chứa logic chính của trò chơi Battle Ship
"""

from enum import Enum
from typing import List, Dict, Tuple, Optional, Any
import copy

class GameState(Enum):
    WAITING = "waiting"
    PLACING_SHIPS = "placing_ships"
    PLAYING = "playing"
    FINISHED = "finished"

class CellState(Enum):
    WATER = "water"        # Nước
    SHIP = "ship"          # Có tàu
    HIT = "hit"            # Tàu bị trúng
    MISS = "miss"          # Bắn trượt

class ShipType(Enum):
    DESTROYER = {"name": "Destroyer", "size": 2, "count": 1}      # Tàu khu trục
    SUBMARINE = {"name": "Submarine", "size": 3, "count": 1}      # Tàu ngầm  
    CRUISER = {"name": "Cruiser", "size": 4, "count": 1}         # Tàu tuần dương
    BATTLESHIP = {"name": "Battleship", "size": 5, "count": 1}   # Tàu chiến

class Ship:
    def __init__(self, ship_type: ShipType, positions: List[Tuple[int, int]]):
        self.ship_type = ship_type
        self.positions = positions  # Danh sách các vị trí (row, col)
        self.hits = set()           # Các vị trí đã bị trúng
        
    @property
    def size(self) -> int:
        return len(self.positions)
        
    @property
    def is_sunk(self) -> bool:
        """Kiểm tra tàu có bị chìm không"""
        return len(self.hits) == len(self.positions)
        
    def hit(self, row: int, col: int) -> bool:
        """Đánh dấu vị trí bị trúng"""
        if (row, col) in self.positions:
            self.hits.add((row, col))
            return True
        return False

class GameBoard:
    def __init__(self, size: int = 10):
        self.size = size
        self.grid = [[CellState.WATER for _ in range(size)] for _ in range(size)]
        self.ships: List[Ship] = []
        
    def is_valid_position(self, row: int, col: int) -> bool:
        """Kiểm tra vị trí có hợp lệ không"""
        return 0 <= row < self.size and 0 <= col < self.size
        
    def is_cell_empty(self, row: int, col: int) -> bool:
        """Kiểm tra ô có trống không"""
        return self.grid[row][col] == CellState.WATER
        
    def can_place_ship(self, positions: List[Tuple[int, int]]) -> bool:
        """Kiểm tra có thể đặt tàu tại các vị trí này không"""
        # Kiểm tra tất cả vị trí hợp lệ
        for row, col in positions:
            if not self.is_valid_position(row, col):
                return False
            if not self.is_cell_empty(row, col):
                return False
                
        # Kiểm tra không có tàu nào ở xung quanh (cách 1 ô)
        for row, col in positions:
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr == 0 and dc == 0:
                        continue
                    nr, nc = row + dr, col + dc
                    if (self.is_valid_position(nr, nc) and 
                        self.grid[nr][nc] == CellState.SHIP and
                        (nr, nc) not in positions):
                        return False
        return True
        
    def place_ship(self, ship_type: ShipType, positions: List[Tuple[int, int]]) -> bool:
        """Đặt tàu tại các vị trí chỉ định"""
        if not self.can_place_ship(positions):
            return False
            
        # Tạo tàu mới
        ship = Ship(ship_type, positions)
        self.ships.append(ship)
        
        # Đánh dấu trên bảng
        for row, col in positions:
            self.grid[row][col] = CellState.SHIP
            
        return True

    def fire_at(self, row: int, col: int) -> Dict[str, Any]:
        """Bắn vào vị trí chỉ định"""
        if not self.is_valid_position(row, col):
            raise ValueError("Vị trí bắn không hợp lệ")
        if self.grid[row][col] in (CellState.HIT, CellState.MISS):
            raise ValueError("Vị trí này đã được bắn rồi")
            
        # Kiểm tra có trúng tàu không
        hit_ship = None
        for ship in self.ships:
            if (row, col) in ship.positions:
                hit_ship = ship
                break
                
        if hit_ship:
            # Trúng tàu
            hit_ship.hit(row, col)
            self.grid[row][col] = CellState.HIT
            
            if hit_ship.is_sunk:
                return {
                    'result': 'sunk',
                    'ship_type': hit_ship.ship_type.name,
                    'ship_positions': hit_ship.positions
                }
            else:
                return {'result': 'hit'}
        else:
            # Bắn trượt
            self.grid[row][col] = CellState.MISS
            return {'result': 'miss'}
            
    def all_ships_sunk(self) -> bool:
        """Kiểm tra tất cả tàu đã chìm chưa"""
        return all(ship.is_sunk for ship in self.ships)
        
    def get_ship_count(self) -> Dict[str, int]:
        """Lấy số lượng tàu còn lại theo loại"""
        remaining = {}
        for ship_type in ShipType:
            remaining[ship_type.value['name']] = 0
            
        for ship in self.ships:
            if not ship.is_sunk:
                remaining[ship.ship_type.value['name']] += 1
                
        return remaining
        
    def get_board_state(self, show_ships: bool = False) -> List[List[str]]:
        """Lấy trạng thái bảng cho client"""
        state = []
        for row in range(self.size):
            row_state = []
            for col in range(self.size):
                cell = self.grid[row][col]
                if cell == CellState.WATER:
                    row_state.append('water')
                elif cell == CellState.MISS:
                    row_state.append('miss')
                elif cell == CellState.HIT:
                    row_state.append('hit')
                elif cell == CellState.SHIP:
                    # Chỉ hiển thị tàu nếu được phép
                    row_state.append('ship' if show_ships else 'water')
                else:
                    row_state.append('water')
            state.append(row_state)
        return state

class Player:
    def __init__(self, player_id: str, name: str):
        self.player_id = player_id
        self.name = name
        self.board = GameBoard()
        self.room_id: Optional[str] = None
        self.ready = False
        
    def place_ships_from_data(self, ships_data: List[Dict]) -> bool:
        """Đặt tàu từ dữ liệu client gửi lên"""
        # Định nghĩa các loại tàu cần đặt
        required_ships = {
            'Destroyer': (ShipType.DESTROYER, 1),     # 1 tàu kích thước 2
            'Submarine': (ShipType.SUBMARINE, 1),     # 1 tàu kích thước 3
            'Cruiser': (ShipType.CRUISER, 1),         # 1 tàu kích thước 4
            'Battleship': (ShipType.BATTLESHIP, 1)    # 1 tàu kích thước 5
        }
        
        ship_counts = {name: 0 for name in required_ships.keys()}
        
        # Kiểm tra và đặt từng tàu
        for ship_data in ships_data:
            ship_name = ship_data.get('type')
            positions = ship_data.get('positions', [])
            
            if ship_name not in required_ships:
                raise ValueError(f"Loại tàu không hợp lệ: {ship_name}")
                
            ship_type, max_count = required_ships[ship_name]
            expected_size = ship_type.value['size']
            
            # Kiểm tra số lượng
            ship_counts[ship_name] += 1
            if ship_counts[ship_name] > max_count:
                raise ValueError(f"Quá nhiều tàu {ship_name}")
                
            # Kiểm tra kích thước
            if len(positions) != expected_size:
                raise ValueError(f"Tàu {ship_name} phải có {expected_size} ô")
                
            # Kiểm tra tàu thẳng hàng
            if not self._is_straight_line(positions):
                raise ValueError(f"Tàu {ship_name} phải đặt thẳng hàng")
                
            # Đặt tàu
            if not self.board.place_ship(ship_type, positions):
                raise ValueError(f"Không thể đặt tàu {ship_name} tại vị trí này")
                
        # Kiểm tra đủ số lượng tàu
        for ship_name, (_, required_count) in required_ships.items():
            if ship_counts[ship_name] != required_count:
                raise ValueError(f"Cần đặt đúng {required_count} tàu {ship_name}")
                
        self.ready = True
        return True
        
    def _is_straight_line(self, positions: List[Tuple[int, int]]) -> bool:
        """Kiểm tra các vị trí có tạo thành đường thẳng không"""
        if len(positions) < 2:
            return True
            
        positions.sort()
        
        # Kiểm tra hàng ngang
        if all(pos[0] == positions[0][0] for pos in positions):
            # Kiểm tra liên tiếp
            for i in range(1, len(positions)):
                if positions[i][1] != positions[i-1][1] + 1:
                    return False
            return True
            
        # Kiểm tra hàng dọc
        if all(pos[1] == positions[0][1] for pos in positions):
            # Kiểm tra liên tiếp
            for i in range(1, len(positions)):
                if positions[i][0] != positions[i-1][0] + 1:
                    return False
            return True
            
        return False

class GameRoom:
    def __init__(self, room_id: str, player1: Player, player2: Player):
        self.room_id = room_id
        self.player1 = player1
        self.player2 = player2
        self.game_state = GameState.PLACING_SHIPS
        self.current_player = player1  # Người chơi hiện tại
        self.turn_count = 0
        
    def get_opponent(self, player_id: str) -> Player:
        """Lấy đối thủ của player"""
        if self.player1.player_id == player_id:
            return self.player2
        else:
            return self.player1
            
    def get_player(self, player_id: str) -> Optional[Player]:
        """Lấy player theo ID"""
        if self.player1.player_id == player_id:
            return self.player1
        elif self.player2.player_id == player_id:
            return self.player2
        return None
        
    def place_ships(self, player_id: str, ships_data: List[Dict]) -> bool:
        """Đặt tàu cho player"""
        player = self.get_player(player_id)
        if not player:
            return False
            
        try:
            return player.place_ships_from_data(ships_data)
        except Exception as e:
            print(f"Lỗi đặt tàu: {e}")
            return False
            
    def both_players_ready(self) -> bool:
        """Kiểm tra cả 2 player đã sẵn sàng chưa"""
        return self.player1.ready and self.player2.ready
        
    def fire_shot(self, shooter_id: str, row: int, col: int) -> Dict[str, Any]:
        """Thực hiện bắn"""
        if self.current_player.player_id != shooter_id:
            raise ValueError("Không phải lượt của bạn")
            
        # Lấy bảng của đối thủ để bắn
        opponent = self.get_opponent(shooter_id)
        result = opponent.board.fire_at(row, col)
        
        # Chuyển lượt nếu bắn trượt
        if result['result'] == 'miss':
            self.switch_turn()
            
        self.turn_count += 1
        return result
        
    def switch_turn(self):
        """Chuyển lượt chơi"""
        self.current_player = self.get_opponent(self.current_player.player_id)
        
    def check_game_over(self) -> bool:
        """Kiểm tra game kết thúc chưa"""
        return (self.player1.board.all_ships_sunk() or 
                self.player2.board.all_ships_sunk())
                
    def get_winner(self) -> Optional[Player]:
        """Lấy người thắng"""
        if self.player1.board.all_ships_sunk():
            return self.player2
        elif self.player2.board.all_ships_sunk():
            return self.player1
        return None
        
    def get_game_state(self, player_id: str) -> Dict[str, Any]:
        """Lấy trạng thái game cho player"""
        player = self.get_player(player_id)
        opponent = self.get_opponent(player_id)
        if player is None or opponent is None:
            raise ValueError("Player hoặc đối thủ không tồn tại")
        return {
            'room_id': self.room_id,
            'game_state': self.game_state.value,
            'current_turn': self.current_player.player_id,
            'turn_count': self.turn_count,
            'your_board': player.board.get_board_state(show_ships=True),
            'opponent_board': opponent.board.get_board_state(show_ships=False),
            'your_ships': player.board.get_ship_count(),
            'opponent_ships': opponent.board.get_ship_count(),
            'player_names': {
                self.player1.player_id: self.player1.name,
                self.player2.player_id: self.player2.name
            }
        }
