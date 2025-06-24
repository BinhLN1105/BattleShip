#!/usr/bin/env python3
"""
Script chạy Battle Ship Server
"""

import sys
import os
import argparse
import signal
import logging
from typing import Optional

# Thêm thư mục hiện tại vào path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import BattleShipServer
from config import get_config, print_config_summary, ServerConfig

def setup_logging(config: ServerConfig):
    """Thiết lập logging"""
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    log_level = getattr(logging, config.LOG_LEVEL.upper(), logging.INFO)
    
    # Tạo logger
    logger = logging.getLogger()
    logger.setLevel(log_level)
    
    # Clear existing handlers
    logger.handlers = []
    
    # Console handler
    if config.ENABLE_CONSOLE_LOG:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_formatter = logging.Formatter(log_format)
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)
    
    # File handler
    if config.LOG_FILE:
        try:
            file_handler = logging.FileHandler(config.LOG_FILE, encoding='utf-8')
            file_handler.setLevel(log_level)
            file_formatter = logging.Formatter(log_format)
            file_handler.setFormatter(file_formatter)
            logger.addHandler(file_handler)
        except Exception as e:
            print(f"⚠️ Không thể tạo log file {config.LOG_FILE}: {e}")

def signal_handler(signum, frame):
    """Xử lý signal để tắt server gracefully"""
    print(f"\n🛑 Nhận signal {signum}, đang tắt server...")
    sys.exit(0)

def validate_environment():
    """Kiểm tra môi trường chạy"""
    try:
        # Kiểm tra Python version
        if sys.version_info < (3, 7):
            print("❌ Cần Python 3.7 trở lên")
            return False
            
        # Kiểm tra các module cần thiết
        required_modules = ['socket', 'threading', 'json', 'uuid', 'time']
        for module in required_modules:
            try:
                __import__(module)
            except ImportError:
                print(f"❌ Thiếu module: {module}")
                return False
                
        return True
        
    except Exception as e:
        print(f"❌ Lỗi kiểm tra môi trường: {e}")
        return False

def main():
    """Hàm main"""
    parser = argparse.ArgumentParser(description='Battle Ship Server')
    parser.add_argument('--host', type=str, help='Host address to bind')
    parser.add_argument('--port', type=int, help='Port number to bind')
    parser.add_argument('--env', type=str, choices=['development', 'production', 'test'],
                       default='development', help='Environment to run in')
    parser.add_argument('--config-only', action='store_true', 
                       help='Chỉ hiển thị cấu hình và thoát')
    parser.add_argument('--validate', action='store_true',
                       help='Validate cấu hình và thoát')
    
    args = parser.parse_args()
    
    print("🚢 Battle Ship Server")
    print("=" * 50)
    
    # Kiểm tra môi trường
    if not validate_environment():
        sys.exit(1)
    
    # Lấy cấu hình
    config = get_config(args.env)
    
    # Override cấu hình từ command line
    if args.host:
        config.HOST = args.host
    if args.port:
        config.PORT = args.port
    
    # Validate cấu hình
    if not config.validate_config():
        print("❌ Cấu hình không hợp lệ")
        sys.exit(1)
    
    # Hiển thị cấu hình
    print_config_summary(config)
    
    if args.config_only:
        print("\n✅ Cấu hình hợp lệ")
        return
        
    if args.validate:
        print("\n✅ Validation thành công")
        return
    
    # Thiết lập logging
    setup_logging(config)
    logger = logging.getLogger(__name__)
    
    # Thiết lập signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Tạo và khởi động server
    try:
        logger.info(f"Khởi tạo server với cấu hình {args.env}")
        server = BattleShipServer(host=config.HOST, port=config.PORT)

        # Nếu BattleShipServer hỗ trợ truyền các tham số này qua constructor, truyền trực tiếp khi khởi tạo
        # Nếu không, bỏ qua việc gán các thuộc tính không tồn tại
        print(f"\n🚀 Khởi động server tại {config.HOST}:{config.PORT}")
        print("Nhấn Ctrl+C để tắt server")
        print("-" * 50)
        
        # Start server (blocking call)
        server.start()
        
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"❌ Port {config.PORT} đã được sử dụng")
            print("💡 Thử port khác hoặc tắt process đang sử dụng port này")
        else:
            print(f"❌ Lỗi network: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Server đã tắt")
        
    except Exception as e:
        logger.error(f"Lỗi không mong đợi: {e}", exc_info=True)
        print(f"❌ Lỗi server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
