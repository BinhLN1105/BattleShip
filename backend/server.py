"""
Battle Ship Game Server
Hỗ trợ multi-client thông qua Socket programming
"""

import socket
import threading
import json
import uuid
import time
from typing import Dict, List, Optional, Tuple
from game_logic import GameRoom, Player, GameState
from protocol import MessageType, create_message, parse_message

class BattleShipServer:
    def __init__(self, host: str = 'localhost', port: int = 8888):
        self.host = host
        self.port = port
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        # Quản lý clients và rooms
        self.clients: Dict[str, socket.socket] = {}  # client_id -> socket
        self.client_info: Dict[str, Player] = {}     # client_id -> Player object
        self.rooms: Dict[str, GameRoom] = {}         # room_id -> GameRoom object
        self.waiting_players: List[str] = []         # Danh sách người chơi đang chờ
        
        # Thread lock cho thread safety
        self.lock = threading.Lock()
        
        print(f"🚢 Battle Ship Server khởi tạo tại {host}:{port}")

    def start(self):
        """Khởi động server"""
        try:
            self.socket.bind((self.host, self.port))
            self.socket.listen(10)
            print(f"✅ Server đang lắng nghe tại {self.host}:{self.port}")
            
            while True:
                client_socket, address = self.socket.accept()
                print(f"🔗 Kết nối mới từ {address}")
                
                # Tạo thread riêng cho mỗi client
                client_thread = threading.Thread(
                    target=self.handle_client,
                    args=(client_socket, address)
                )
                client_thread.daemon = True
                client_thread.start()
                
        except Exception as e:
            print(f"❌ Lỗi server: {e}")
        finally:
            self.socket.close()

    def handle_client(self, client_socket: socket.socket, address: Tuple[str, int]):
        """Xử lý một client cụ thể"""
        client_id = str(uuid.uuid4())
        
        try:
            # Đăng ký client
            with self.lock:
                self.clients[client_id] = client_socket
                
            print(f"👤 Client {client_id} từ {address} đã kết nối")
            
            # Gửi thông báo kết nối thành công
            welcome_msg = create_message(MessageType.CONNECTION_SUCCESS, {
                'client_id': client_id,
                'message': 'Kết nối thành công đến Battle Ship Server!'
            })
            self.send_to_client(client_id, welcome_msg)
            
            # Lắng nghe messages từ client
            while True:
                try:
                    data = client_socket.recv(4096).decode('utf-8')
                    if not data:
                        break
                        
                    # Parse message
                    message = parse_message(data)
                    if message:
                        self.process_message(client_id, message)
                        
                except socket.timeout:
                    continue
                except Exception as e:
                    print(f"❌ Lỗi xử lý message từ {client_id}: {e}")
                    break
                    
        except Exception as e:
            print(f"❌ Lỗi xử lý client {client_id}: {e}")
        finally:
            self.disconnect_client(client_id)

    def process_message(self, client_id: str, message: dict):
        """Xử lý message từ client"""
        msg_type = message.get('type')
        data = message.get('data', {})
        
        print(f"📨 Nhận message từ {client_id}: {msg_type}")
        
        try:
            if msg_type == MessageType.JOIN_QUEUE:
                self.handle_join_queue(client_id, data)
            elif msg_type == MessageType.LEAVE_QUEUE:
                self.handle_leave_queue(client_id)
            elif msg_type == MessageType.PLACE_SHIPS:
                self.handle_place_ships(client_id, data)
            elif msg_type == MessageType.FIRE_SHOT:
                self.handle_fire_shot(client_id, data)
            elif msg_type == MessageType.SURRENDER:
                self.handle_surrender(client_id)
            elif msg_type == MessageType.CHAT_MESSAGE:
                self.handle_chat_message(client_id, data)
            else:
                print(f"⚠️ Message type không hỗ trợ: {msg_type}")
                
        except Exception as e:
            print(f"❌ Lỗi xử lý message {msg_type} từ {client_id}: {e}")
            error_msg = create_message(MessageType.ERROR, {
                'message': f'Lỗi xử lý: {str(e)}'
            })
            self.send_to_client(client_id, error_msg)

    def handle_join_queue(self, client_id: str, data: dict):
        """Xử lý khi player muốn tham gia queue"""
        player_name = data.get('player_name', f'Player_{client_id[:8]}')
        
        with self.lock:
            # Tạo player object
            player = Player(client_id, player_name)
            self.client_info[client_id] = player
            
            # Thêm vào waiting queue
            if client_id not in self.waiting_players:
                self.waiting_players.append(client_id)
                
            print(f"🎯 {player_name} tham gia queue (Queue size: {len(self.waiting_players)})")
            
            # Gửi thông báo tham gia queue thành công
            queue_msg = create_message(MessageType.QUEUE_JOINED, {
                'position': len(self.waiting_players),
                'message': f'Đã tham gia queue. Vị trí: {len(self.waiting_players)}'
            })
            self.send_to_client(client_id, queue_msg)
            
            # Kiểm tra xem có thể tạo game không (cần ít nhất 2 người)
            self.try_create_game()

    def try_create_game(self):
        """Thử tạo game mới nếu có đủ người chơi"""
        if len(self.waiting_players) >= 2:
            # Lấy 2 người chơi đầu tiên
            player1_id = self.waiting_players.pop(0)
            player2_id = self.waiting_players.pop(0)
            
            # Tạo room mới
            room_id = str(uuid.uuid4())
            player1 = self.client_info[player1_id]
            player2 = self.client_info[player2_id]
            
            room = GameRoom(room_id, player1, player2)
            self.rooms[room_id] = room
            
            # Cập nhật player về room
            player1.room_id = room_id
            player2.room_id = room_id
            
            print(f"🎮 Tạo game mới: {room_id} ({player1.name} vs {player2.name})")
            
            # Thông báo cho cả 2 người chơi
            game_start_msg = create_message(MessageType.GAME_FOUND, {
                'room_id': room_id,
                'opponent': player2.name,
                'your_turn': True  # Player 1 đi trước
            })
            self.send_to_client(player1_id, game_start_msg)
            
            game_start_msg['data']['opponent'] = player1.name
            game_start_msg['data']['your_turn'] = False
            self.send_to_client(player2_id, game_start_msg)

    def handle_place_ships(self, client_id: str, data: dict):
        """Xử lý khi player đặt tàu"""
        player = self.client_info.get(client_id)
        if not player or not player.room_id:
            return
            
        room = self.rooms.get(player.room_id)
        if not room:
            return
            
        ships_data = data.get('ships', [])
        
        try:
            # Đặt tàu cho player
            success = room.place_ships(client_id, ships_data)
            
            if success:
                response_msg = create_message(MessageType.SHIPS_PLACED, {
                    'message': 'Đã đặt tàu thành công!'
                })
                self.send_to_client(client_id, response_msg)
                
                # Kiểm tra xem cả 2 player đã đặt tàu chưa
                if room.both_players_ready():
                    self.start_game(room)
            else:
                error_msg = create_message(MessageType.ERROR, {
                    'message': 'Vị trí đặt tàu không hợp lệ!'
                })
                self.send_to_client(client_id, error_msg)
                
        except Exception as e:
            error_msg = create_message(MessageType.ERROR, {
                'message': f'Lỗi đặt tàu: {str(e)}'
            })
            self.send_to_client(client_id, error_msg)

    def start_game(self, room: GameRoom):
        """Bắt đầu game khi cả 2 player đã sẵn sàng"""
        print(f"🚀 Bắt đầu game trong room {room.room_id}")
        
        room.game_state = GameState.PLAYING
        
        # Thông báo game bắt đầu cho cả 2 player
        game_start_msg = create_message(MessageType.GAME_START, {
            'message': 'Game bắt đầu! Hãy bắn vào bảng của đối thủ!',
            'current_turn': room.current_player.player_id
        })
        
        self.send_to_client(room.player1.player_id, game_start_msg)
        self.send_to_client(room.player2.player_id, game_start_msg)

    def handle_fire_shot(self, client_id: str, data: dict):
        """Xử lý khi player bắn"""
        player = self.client_info.get(client_id)
        if not player or not player.room_id:
            return
            
        room = self.rooms.get(player.room_id)
        if not room or room.game_state != GameState.PLAYING:
            return
            
        if room.current_player.player_id != client_id:
            error_msg = create_message(MessageType.ERROR, {
                'message': 'Không phải lượt của bạn!'
            })
            self.send_to_client(client_id, error_msg)
            return
            
        row = data.get('row')
        col = data.get('col')
        
        try:
            # Thực hiện bắn
            result = room.fire_shot(client_id, row, col)
            
            # Gửi kết quả cho cả 2 player
            shot_result_msg = create_message(MessageType.SHOT_RESULT, {
                'shooter': client_id,
                'row': row,
                'col': col,
                'result': result['result'],  # 'miss', 'hit', 'sunk'
                'current_turn': room.current_player.player_id
            })
            
            self.send_to_client(room.player1.player_id, shot_result_msg)
            self.send_to_client(room.player2.player_id, shot_result_msg)
            
            # Kiểm tra game over
            if room.check_game_over():
                winner = room.get_winner()
                game_over_msg = create_message(MessageType.GAME_OVER, {
                    'winner': winner.player_id,
                    'winner_name': winner.name,
                    'message': f'{winner.name} đã thắng!'
                })
                
                self.send_to_client(room.player1.player_id, game_over_msg)
                self.send_to_client(room.player2.player_id, game_over_msg)
                
                # Cleanup room
                self.cleanup_room(room.room_id)
                
        except Exception as e:
            error_msg = create_message(MessageType.ERROR, {
                'message': f'Lỗi bắn: {str(e)}'
            })
            self.send_to_client(client_id, error_msg)

    def handle_surrender(self, client_id: str):
        """Xử lý khi player đầu hàng"""
        player = self.client_info.get(client_id)
        if not player or not player.room_id:
            return
            
        room = self.rooms.get(player.room_id)
        if not room:
            return
            
        # Tìm người thắng (người không đầu hàng)
        winner = room.player2 if room.player1.player_id == client_id else room.player1
        
        surrender_msg = create_message(MessageType.GAME_OVER, {
            'winner': winner.player_id,
            'winner_name': winner.name,
            'message': f'{player.name} đã đầu hàng. {winner.name} thắng!'
        })
        
        self.send_to_client(room.player1.player_id, surrender_msg)
        self.send_to_client(room.player2.player_id, surrender_msg)
        
        # Cleanup room
        self.cleanup_room(room.room_id)

    def handle_chat_message(self, client_id: str, data: dict):
        """Xử lý tin nhắn chat"""
        player = self.client_info.get(client_id)
        if not player or not player.room_id:
            return
            
        room = self.rooms.get(player.room_id)
        if not room:
            return
            
        message_text = data.get('message', '')
        
        chat_msg = create_message(MessageType.CHAT_MESSAGE, {
            'sender': player.name,
            'message': message_text,
            'timestamp': int(time.time())
        })
        
        # Gửi cho cả 2 player trong room
        self.send_to_client(room.player1.player_id, chat_msg)
        self.send_to_client(room.player2.player_id, chat_msg)

    def handle_leave_queue(self, client_id: str):
        """Xử lý khi player rời queue"""
        with self.lock:
            if client_id in self.waiting_players:
                self.waiting_players.remove(client_id)
                
        leave_msg = create_message(MessageType.QUEUE_LEFT, {
            'message': 'Đã rời khỏi queue'
        })
        self.send_to_client(client_id, leave_msg)

    def cleanup_room(self, room_id: str):
        """Dọn dẹp room sau khi game kết thúc"""
        if room_id in self.rooms:
            room = self.rooms[room_id]
            
            # Reset player room info
            if room.player1.player_id in self.client_info:
                self.client_info[room.player1.player_id].room_id = None
            if room.player2.player_id in self.client_info:
                self.client_info[room.player2.player_id].room_id = None
                
            # Xóa room
            del self.rooms[room_id]
            print(f"🧹 Đã cleanup room {room_id}")

    def send_to_client(self, client_id: str, message: dict):
        """Gửi message tới client cụ thể"""
        try:
            if client_id in self.clients:
                client_socket = self.clients[client_id]
                message_str = json.dumps(message, ensure_ascii=False) + '\n'
                client_socket.send(message_str.encode('utf-8'))
        except Exception as e:
            print(f"❌ Lỗi gửi message tới {client_id}: {e}")
            self.disconnect_client(client_id)

    def disconnect_client(self, client_id: str):
        """Xử lý khi client ngắt kết nối"""
        print(f"🔌 Client {client_id} ngắt kết nối")
        
        with self.lock:
            # Xóa khỏi clients
            if client_id in self.clients:
                try:
                    self.clients[client_id].close()
                except:
                    pass
                del self.clients[client_id]
                
            # Xóa khỏi waiting players
            if client_id in self.waiting_players:
                self.waiting_players.remove(client_id)
                
            # Xử lý nếu đang trong game
            if client_id in self.client_info:
                player = self.client_info[client_id]
                if player.room_id:
                    room = self.rooms.get(player.room_id)
                    if room:
                        # Thông báo cho đối thủ
                        opponent = room.player2 if room.player1.player_id == client_id else room.player1
                        disconnect_msg = create_message(MessageType.OPPONENT_DISCONNECTED, {
                            'message': f'{player.name} đã ngắt kết nối. Bạn thắng!'
                        })
                        self.send_to_client(opponent.player_id, disconnect_msg)
                        
                        # Cleanup room
                        self.cleanup_room(player.room_id)
                        
                del self.client_info[client_id]

if __name__ == "__main__":
    server = BattleShipServer()
    try:
        server.start()
    except KeyboardInterrupt:
        print("\n🛑 Server đang tắt...")
    except Exception as e:
        print(f"❌ Lỗi server: {e}")
