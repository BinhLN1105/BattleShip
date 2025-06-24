"""
Configuration file cho Battle Ship Server
"""

import os
from typing import Dict, Any

class ServerConfig:
    """Cấu hình server"""
    
    # Network settings
    HOST = os.getenv('BATTLESHIP_HOST', 'localhost')
    PORT = int(os.getenv('BATTLESHIP_PORT', 8888))
    MAX_CONNECTIONS = int(os.getenv('BATTLESHIP_MAX_CONNECTIONS', 100))
    
    # Socket settings
    SOCKET_TIMEOUT = int(os.getenv('BATTLESHIP_SOCKET_TIMEOUT', 30))  # seconds
    BUFFER_SIZE = int(os.getenv('BATTLESHIP_BUFFER_SIZE', 4096))
    
    # Game settings
    BOARD_SIZE = 10
    MAX_PLAYER_NAME_LENGTH = 50
    MAX_CHAT_MESSAGE_LENGTH = 500
    GAME_TIMEOUT = int(os.getenv('BATTLESHIP_GAME_TIMEOUT', 1800))  # 30 minutes
    
    # Queue settings
    QUEUE_TIMEOUT = int(os.getenv('BATTLESHIP_QUEUE_TIMEOUT', 300))  # 5 minutes
    MAX_QUEUE_SIZE = int(os.getenv('BATTLESHIP_MAX_QUEUE_SIZE', 50))
    
    # Logging settings
    LOG_LEVEL = os.getenv('BATTLESHIP_LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('BATTLESHIP_LOG_FILE', 'battleship_server.log')
    ENABLE_CONSOLE_LOG = os.getenv('BATTLESHIP_CONSOLE_LOG', 'true').lower() == 'true'
    
    # Security settings
    ENABLE_RATE_LIMITING = os.getenv('BATTLESHIP_RATE_LIMITING', 'true').lower() == 'true'
    MAX_MESSAGES_PER_MINUTE = int(os.getenv('BATTLESHIP_MAX_MSG_PER_MIN', 60))
    
    # Ship configuration
    SHIP_CONFIG = {
        'Destroyer': {'size': 2, 'count': 4},
        'Submarine': {'size': 3, 'count': 3},
        'Cruiser': {'size': 4, 'count': 2},
        'Battleship': {'size': 5, 'count': 1}
    }
    
    @classmethod
    def get_all_config(cls) -> Dict[str, Any]:
        """Lấy tất cả cấu hình"""
        return {
            'network': {
                'host': cls.HOST,
                'port': cls.PORT,
                'max_connections': cls.MAX_CONNECTIONS,
                'socket_timeout': cls.SOCKET_TIMEOUT,
                'buffer_size': cls.BUFFER_SIZE
            },
            'game': {
                'board_size': cls.BOARD_SIZE,
                'max_player_name_length': cls.MAX_PLAYER_NAME_LENGTH,
                'max_chat_message_length': cls.MAX_CHAT_MESSAGE_LENGTH,
                'game_timeout': cls.GAME_TIMEOUT,
                'ship_config': cls.SHIP_CONFIG
            },
            'queue': {
                'queue_timeout': cls.QUEUE_TIMEOUT,
                'max_queue_size': cls.MAX_QUEUE_SIZE
            },
            'logging': {
                'log_level': cls.LOG_LEVEL,
                'log_file': cls.LOG_FILE,
                'enable_console_log': cls.ENABLE_CONSOLE_LOG
            },
            'security': {
                'enable_rate_limiting': cls.ENABLE_RATE_LIMITING,
                'max_messages_per_minute': cls.MAX_MESSAGES_PER_MINUTE
            }
        }
    
    @classmethod
    def validate_config(cls) -> bool:
        """Validate cấu hình"""
        try:
            # Kiểm tra port hợp lệ
            if not (1024 <= cls.PORT <= 65535):
                print(f"❌ Port không hợp lệ: {cls.PORT}")
                return False
                
            # Kiểm tra buffer size
            if cls.BUFFER_SIZE < 1024:
                print(f"❌ Buffer size quá nhỏ: {cls.BUFFER_SIZE}")
                return False
                
            # Kiểm tra timeouts
            if cls.SOCKET_TIMEOUT < 1:
                print(f"❌ Socket timeout không hợp lệ: {cls.SOCKET_TIMEOUT}")
                return False
                
            if cls.GAME_TIMEOUT < 60:
                print(f"❌ Game timeout quá ngắn: {cls.GAME_TIMEOUT}")
                return False
                
            # Kiểm tra ship config
            total_ships = sum(ship['count'] for ship in cls.SHIP_CONFIG.values())
            if total_ships != 10:
                print(f"❌ Tổng số tàu không đúng: {total_ships} (phải là 10)")
                return False
                
            return True
            
        except Exception as e:
            print(f"❌ Lỗi validate config: {e}")
            return False

class DevelopmentConfig(ServerConfig):
    """Cấu hình cho development"""
    HOST = 'localhost'
    PORT = 8888
    LOG_LEVEL = 'DEBUG'
    ENABLE_CONSOLE_LOG = True
    SOCKET_TIMEOUT = 10

class ProductionConfig(ServerConfig):
    """Cấu hình cho production"""
    HOST = '0.0.0.0'
    PORT = int(os.getenv('PORT', 8888))  # Heroku/Cloud port
    LOG_LEVEL = 'INFO'
    ENABLE_CONSOLE_LOG = False
    SOCKET_TIMEOUT = 60
    ENABLE_RATE_LIMITING = True

class TestConfig(ServerConfig):
    """Cấu hình cho testing"""
    HOST = 'localhost'
    PORT = 9999
    LOG_LEVEL = 'DEBUG'
    GAME_TIMEOUT = 60
    QUEUE_TIMEOUT = 30

def get_config(env: str = '') -> ServerConfig:
    """Lấy config theo environment"""
    env = env or os.getenv('BATTLESHIP_ENV', 'development')
    
    if env == 'production':
        return ProductionConfig()
    elif env == 'test':
        return TestConfig()
    else:
        return DevelopmentConfig()

def print_config_summary(config: ServerConfig):
    """In tóm tắt cấu hình"""
    print("🔧 Battle Ship Server Configuration:")
    print(f"   📡 Network: {config.HOST}:{config.PORT}")
    print(f"   🎮 Game timeout: {config.GAME_TIMEOUT}s")
    print(f"   📋 Queue timeout: {config.QUEUE_TIMEOUT}s")
    print(f"   📝 Log level: {config.LOG_LEVEL}")
    print(f"   🛡️ Rate limiting: {'ON' if config.ENABLE_RATE_LIMITING else 'OFF'}")
    print(f"   🚢 Ships: {sum(ship['count'] for ship in config.SHIP_CONFIG.values())} total")
