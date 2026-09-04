import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

logger = logging.getLogger("battleship_db")

# --- Đọc file .env nếu có (không cần thư viện ngoài) ---
def load_env_file():
    candidates = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.join(os.path.dirname(__file__), ".env"),
    ]
    for env_path in candidates:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip("\"'")
                        if key not in os.environ:
                            os.environ[key] = val
                break
            except Exception as e:
                logger.warning(f"Lỗi đọc .env tại {env_path}: {e}")

load_env_file()

# --- Lấy cấu hình từ biến môi trường ---
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
POSTGRES_DB = os.getenv("POSTGRES_DB", "battleship")

try:
    import asyncpg
    HAS_ASYNCPG = True
except ImportError:
    asyncpg = None
    HAS_ASYNCPG = False

pool: Optional[Any] = None

async def init_db() -> bool:
    global pool
    if not HAS_ASYNCPG:
        print("[DB] [WARN] Thu vien 'asyncpg' chua duoc cai dat. Che do: Fallback JSON.")
        return False

    try:
        print(f"[DB] [CONNECT] Dang ket noi PostgreSQL ({POSTGRES_USER}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB})...")
        pool = await asyncpg.create_pool(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            database=POSTGRES_DB,
            min_size=1,
            max_size=10,
            command_timeout=10,
            timeout=3
        )

        async with pool.acquire() as conn:
            # Tạo bảng users
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(64) UNIQUE NOT NULL,
                    fleet_preference VARCHAR(32) DEFAULT 'modern',
                    elo INT DEFAULT 1000,
                    wins INT DEFAULT 0,
                    losses INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ''')

            # Tạo bảng games với cột details JSONB
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS games (
                    id VARCHAR(64) PRIMARY KEY,
                    player1_name VARCHAR(64) NOT NULL,
                    player2_name VARCHAR(64) NOT NULL,
                    winner_name VARCHAR(64),
                    player1_fleet VARCHAR(32),
                    player2_fleet VARCHAR(32),
                    reason VARCHAR(32),
                    details JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ''')

            # Tạo các index tăng tốc truy vấn
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_users_elo ON users (elo DESC);')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_games_created ON games (created_at DESC);')

        print("[DB] [OK] Ket noi PostgreSQL thanh cong! Da khoi tao schema users & games (JSONB).")
        return True

    except Exception as e:
        print(f"[DB] [WARN] Khong the ket noi PostgreSQL: {e}")
        print("[DB] [FALLBACK] Kich hoat Graceful Fallback: Tro choi tiep tuc luu qua game_history.json.")
        pool = None
        return False

async def close_db():
    global pool
    if pool is not None:
        try:
            await pool.close()
            print("[DB] Da dong ket noi PostgreSQL.")
        except Exception as e:
            print(f"[DB] [ERROR] Loi khi dong pool: {e}")
        pool = None

async def get_or_create_user(username: str, fleet_preference: str = "modern") -> Dict[str, Any]:
    if pool is None:
        return {
            "username": username,
            "fleet_preference": fleet_preference,
            "elo": 1000,
            "wins": 0,
            "losses": 0
        }

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow('''
                INSERT INTO users (username, fleet_preference)
                VALUES ($1, $2)
                ON CONFLICT (username) DO UPDATE
                SET fleet_preference = EXCLUDED.fleet_preference,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, username, fleet_preference, elo, wins, losses;
            ''', username, fleet_preference)
            return dict(row) if row else {}
    except Exception as e:
        print(f"[DB] [ERROR] Loi get_or_create_user: {e}")
        return {"username": username, "fleet_preference": fleet_preference, "elo": 1000, "wins": 0, "losses": 0}

async def record_game(
    game_id: str,
    player1_name: str,
    player2_name: str,
    winner_name: Optional[str],
    player1_fleet: str = "modern",
    player2_fleet: str = "modern",
    reason: str = "all_sunk",
    details: Optional[Dict[str, Any]] = None
) -> bool:
    if pool is None:
        return False

    try:
        details_json = json.dumps(details or {}, ensure_ascii=False)
        async with pool.acquire() as conn:
            async with conn.transaction():
                # 1. Lưu ván đấu vào bảng games
                await conn.execute('''
                    INSERT INTO games (id, player1_name, player2_name, winner_name, player1_fleet, player2_fleet, reason, details)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
                    ON CONFLICT (id) DO NOTHING;
                ''', game_id, player1_name, player2_name, winner_name, player1_fleet, player2_fleet, reason, details_json)

                # 2. Cập nhật Elo và số trận Thắng/Thua cho users
                if winner_name:
                    loser_name = player2_name if winner_name == player1_name else player1_name
                    # Đảm bảo cả 2 user đã tồn tại
                    await conn.execute('INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING;', winner_name)
                    await conn.execute('INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING;', loser_name)

                    # Người thắng: +25 Elo, +1 Win
                    await conn.execute('''
                        UPDATE users
                        SET wins = wins + 1,
                            elo = elo + 25,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE username = $1;
                    ''', winner_name)

                    # Người thua: -20 Elo (tối thiểu 100), +1 Loss
                    await conn.execute('''
                        UPDATE users
                        SET losses = losses + 1,
                            elo = GREATEST(100, elo - 20),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE username = $1;
                    ''', loser_name)

        print(f"[DB] [SAVE] Da luu van dau {game_id} va cap nhat Rank vao PostgreSQL thanh cong.")
        return True
    except Exception as e:
        print(f"[DB] [WARN] Loi khi luu van dau vao PostgreSQL: {e}")
        return False

async def get_leaderboard(limit: int = 10) -> List[Dict[str, Any]]:
    if pool is None:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch('''
                SELECT username, fleet_preference, elo, wins, losses,
                       ROUND(CASE WHEN (wins + losses) > 0 THEN (wins::numeric / (wins + losses) * 100) ELSE 0 END, 1) as win_rate
                FROM users
                ORDER BY elo DESC, wins DESC
                LIMIT $1;
            ''', limit)
            res = []
            for r in rows:
                d = dict(r)
                if "win_rate" in d and d["win_rate"] is not None:
                    d["win_rate"] = float(d["win_rate"])
                res.append(d)
            return res
    except Exception as e:
        print(f"[DB] [ERROR] Loi lay leaderboard: {e}")
        return []

async def get_recent_games(limit: int = 20) -> List[Dict[str, Any]]:
    if pool is None:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch('''
                SELECT id, player1_name, player2_name, winner_name, player1_fleet, player2_fleet, reason, created_at
                FROM games
                ORDER BY created_at DESC
                LIMIT $1;
            ''', limit)
            res = []
            for r in rows:
                d = dict(r)
                if isinstance(d.get("created_at"), datetime):
                    d["created_at"] = d["created_at"].isoformat()
                res.append(d)
            return res
    except Exception as e:
        print(f"[DB] [ERROR] Loi lay recent games: {e}")
        return []
