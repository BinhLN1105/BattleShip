#!/usr/bin/env python3
"""
Test client cho Battle Ship Server
Dùng để test các tính năng của server
"""

import socket
import json
import threading
import time
import sys
from typing import Dict, Any
from protocol import MessageType, create_message

class TestClient:
    def __init__(self, host: str = 'localhost', port: int = 8888, name: str = "TestPlayer"):
        self.host = host
        self.port = port
        self.name = name
        self.socket = None
        self.connected = False
        self.client_id = None
        self.room_id = None
        
    def connect(self) -> bool:
        """Kết nối tới server"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.host, self.port))
            self.connected = True
            
            print(f"✅ Đã kết nối tới server {self.host}:{self.port}")
            
            # Bắt đầu thread lắng nghe messages
            listen_thread = threading.Thread(target=self._listen_messages)
            listen_thread.daemon = True
            listen_thread.start()
            
            return True
            
        except Exception as e:
            print(f"❌ Lỗi kết nối: {e}")
            return False
    
    def disconnect(self):
        """Ngắt kết nối"""
        self.connected = False
        if self.socket:
            self.socket.close()
        print("🔌 Đã ngắt kết nối")
    
    def _listen_messages(self):
        """Lắng nghe messages từ server"""
        while self.connected and self.socket:
            try:
                data = self.socket.recv(4096)
                if not data:
                    break

                decoded_data = data.decode('utf-8')
                if not decoded_data.strip():
                    break

                message = json.loads(decoded_data)
                self._handle_message(message)
                
            except Exception as e:
                if self.connected:
                    print(f"❌ Lỗi nhận message: {e}")
                break
    
    def _handle_message(self, message: Dict[str, Any]):
        """Xử lý message từ server"""
        msg_type = message.get('type')
        data = message.get('data', {})
        
        print(f"📨 Nhận: {msg_type}")
        
        if msg_type == MessageType.CONNECTION_SUCCESS:
            self.client_id = data.get('client_id')
            print(f"🎯 Client ID: {self.client_id}")
            
        elif msg_type == MessageType.QUEUE_JOINED:
            print(f"🎮 Tham gia queue thành công. Vị trí: {data.get('position')}")
            
        elif msg_type == MessageType.GAME_FOUND:
            self.room_id = data.get('room_id')
            opponent = data.get('opponent')
            your_turn = data.get('your_turn')
            print(f"🎯 Tìm thấy game! Đối thủ: {opponent}, Room: {self.room_id}")
            print(f"   Lượt của bạn: {'Có' if your_turn else 'Không'}")
            
        elif msg_type == MessageType.GAME_START:
            print(f"🚀 Game bắt đầu! Turn hiện tại: {data.get('current_turn')}")
            
        elif msg_type == MessageType.SHIPS_PLACED:
            print("✅ Đặt tàu thành công!")
            
        elif msg_type == MessageType.SHOT_RESULT:
            shooter = data.get('shooter')
            row, col = data.get('row'), data.get('col')
            result = data.get('result')
            current_turn = data.get('current_turn')
            
            is_my_shot = shooter == self.client_id
            print(f"💥 {'Bạn' if is_my_shot else 'Đối thủ'} bắn ({row},{col}): {result}")
            print(f"   Lượt tiếp theo: {current_turn}")
            
        elif msg_type == MessageType.GAME_OVER:
            winner = data.get('winner_name')
            message = data.get('message')
            print(f"🏆 {message}")
            
        elif msg_type == MessageType.ERROR:
            print(f"❌ Lỗi: {data.get('message')}")
            
        else:
            print(f"📋 {msg_type}: {data}")
    
    def send_message(self, message: Dict[str, Any]):
        """Gửi message tới server"""
        if self.socket is None:
            print("❌ Không thể gửi message: socket chưa được kết nối.")
            return
        try:
            message_str = json.dumps(message, ensure_ascii=False) + '\n'
            self.socket.send(message_str.encode('utf-8'))
        except Exception as e:
            print(f"❌ Lỗi gửi message: {e}")
    
    def join_queue(self):
        """Gửi yêu cầu tham gia queue với tên hiện tại"""
        message = create_message(MessageType.JOIN_QUEUE, {
            'player_name': self.name
        })
        self.send_message(message)
        print(f"🎮 Gửi yêu cầu tham gia queue với tên: {self.name}")
    
    def place_ships(self):
        """Đặt tàu (mẫu cố định)"""
        ships_data = [
            # 4 Destroyers (size 2)
            {'type': 'Destroyer', 'positions': [[0, 0], [0, 1]]},
            {'type': 'Destroyer', 'positions': [[2, 0], [2, 1]]},
            {'type': 'Destroyer', 'positions': [[4, 0], [4, 1]]},
            {'type': 'Destroyer', 'positions': [[6, 0], [6, 1]]},
            
            # 3 Submarines (size 3)
            {'type': 'Submarine', 'positions': [[0, 3], [0, 4], [0, 5]]},
            {'type': 'Submarine', 'positions': [[2, 3], [2, 4], [2, 5]]},
            {'type': 'Submarine', 'positions': [[4, 3], [4, 4], [4, 5]]},
            
            # 2 Cruisers (size 4)
            {'type': 'Cruiser', 'positions': [[0, 7], [1, 7], [2, 7], [3, 7]]},
            {'type': 'Cruiser', 'positions': [[5, 7], [6, 7], [7, 7], [8, 7]]},
            
            # 1 Battleship (size 5)
            {'type': 'Battleship', 'positions': [[6, 3], [7, 3], [8, 3], [9, 3], [9, 4]]}
        ]
        
        message = create_message(MessageType.PLACE_SHIPS, {
            'ships': ships_data
        })
        self.send_message(message)
        print("🚢 Gửi yêu cầu đặt tàu")
    
    def fire_shot(self, row: int, col: int):
        """Bắn vào vị trí"""
        message = create_message(MessageType.FIRE_SHOT, {
            'row': row,
            'col': col
        })
        self.send_message(message)
        print(f"💥 Bắn vào ({row}, {col})")
    
    def send_chat(self, text: str):
        """Gửi tin nhắn chat"""
        message = create_message(MessageType.CHAT_MESSAGE, {
            'message': text
        })
        self.send_message(message)
        print(f"💬 Chat: {text}")
    
    def surrender(self):
        """Đầu hàng"""
        message = create_message(MessageType.SURRENDER, {})
        self.send_message(message)
        print("🏳️ Đầu hàng")

def test_basic_connection():
    """Test kết nối cơ bản"""
    print("🧪 Test 1: Kết nối cơ bản")
    
    client = TestClient(name="TestBot1")
    if client.connect():
        time.sleep(2)  # Chờ message từ server
        client.disconnect()
        print("✅ Test kết nối thành công\n")
    else:
        print("❌ Test kết nối thất bại\n")

def test_queue_system():
    """Test hệ thống queue"""
    print("🧪 Test 2: Hệ thống queue")
    
    client = TestClient(name="QueueTester")
    if client.connect():
        time.sleep(1)
        client.send_message(create_message(MessageType.JOIN_QUEUE, {}))
        time.sleep(3)
        client.disconnect()
        print("✅ Test queue thành công\n")
    else:
        print("❌ Test queue thất bại\n")

def test_two_players():
    """Test 2 người chơi"""
    print("🧪 Test 3: Game 2 người chơi")
    
    # Tạo 2 clients
    client1 = TestClient(name="Player1")
    client2 = TestClient(name="Player2")
    
    if client1.connect() and client2.connect():
        time.sleep(1)
        
        # Cả 2 tham gia queue
        client1.send_message(create_message(MessageType.JOIN_QUEUE, {}))
        time.sleep(0.5)
        client2.send_message(create_message(MessageType.JOIN_QUEUE, {}))
        
        # Chờ tìm game
        time.sleep(2)
        
        # Đặt tàu
        client1.place_ships()
        client2.place_ships()
        
        # Chờ game bắt đầu
        time.sleep(2)
        
        # Test một vài lượt bắn
        client1.fire_shot(0, 0)
        time.sleep(1)
        client2.fire_shot(1, 1)
        time.sleep(1)
        client1.fire_shot(2, 2)
        
        # Chat test
        client1.send_chat("Chào bạn!")
        client2.send_chat("Chào lại!")
        
        time.sleep(3)
        
        client1.disconnect()
        client2.disconnect()
        print("✅ Test 2 players thành công\n")
    else:
        print("❌ Test 2 players thất bại\n")

def interactive_client():
    """Client tương tác"""
    print("🎮 Interactive Battle Ship Client")
    print("Commands:")
    print("  connect - Kết nối tới server")
    print("  queue - Tham gia queue")
    print("  ships - Đặt tàu")
    print("  fire <row> <col> - Bắn")
    print("  chat <message> - Gửi chat")
    print("  surrender - Đầu hàng")
    print("  quit - Thoát")
    print("-" * 40)
    
    client = TestClient(name=input("Nhập tên của bạn: "))
    
    while True:
        try:
            command = input("> ").strip().split()
            if not command:
                continue
                
            cmd = command[0].lower()
            
            if cmd == "connect":
                client.connect()
            elif cmd == "queue":
                client.join_queue()
            elif cmd == "ships":
                client.place_ships()
            elif cmd == "fire" and len(command) >= 3:
                row, col = int(command[1]), int(command[2])
                client.fire_shot(row, col)
            elif cmd == "chat" and len(command) >= 2:
                message = " ".join(command[1:])
                client.send_chat(message)
            elif cmd == "surrender":
                client.surrender()
            elif cmd == "quit":
                client.disconnect()
                break
            else:
                print("❌ Lệnh không hợp lệ")
                
        except KeyboardInterrupt:
            print("\n🛑 Thoát...")
            client.disconnect()
            break
        except Exception as e:
            print(f"❌ Lỗi: {e}")

def main():
    """Hàm main"""
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        interactive_client()
    else:
        print("🧪 Battle Ship Server Test Suite")
        print("=" * 40)
        
        # Chạy các test
        test_basic_connection()
        test_queue_system()
        test_two_players()
        
        print("✅ Hoàn thành tất cả tests")
        print("\n💡 Chạy 'python test_client.py interactive' để dùng interactive client")

if __name__ == "__main__":
    main()
