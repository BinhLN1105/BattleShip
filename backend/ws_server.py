import asyncio
import websockets  # type: ignore
import json
import uuid
import random
import os
import sys
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

try:
    from backend import db
except ImportError:
    import db

clients = {}  # client_id -> websocket
queue = []    # Danh sách client_id đang chờ ghép trận
players = {}  # client_id -> {'name': ..., 'websocket': ..., 'ships': ..., 'ready': ..., 'shots': ...}
games = {}    # game_id -> {'players': [client_id1, client_id2], 'boards': {...}, 'turn': client_id, 'status': ..., 'timeout_task': ...}
game_history = []  # Lưu lịch sử trận đấu
HISTORY_FILE = "game_history.json"

# --- Cấu hình game ---
BOARD_SIZE = 10
SHIP_RULES = [
    {"type": "Destroyer", "size": 2, "count": 1},
    {"type": "Submarine", "size": 3, "count": 2},
    {"type": "Cruiser", "size": 4, "count": 1},
    {"type": "Battleship", "size": 5, "count": 1},
]
TURN_TIMEOUT = 30  # giây

async def send(client_id, message):
    ws = clients.get(client_id)
    if ws:
        await ws.send(json.dumps(message))

async def broadcast(client_ids, message):
    for cid in client_ids:
        await send(cid, message)

def all_ships_placed(game_id):
    game = games[game_id]
    for cid in game['players']:
        if not players[cid].get('ready'):
            return False
    return True

def check_all_ships_sunk(board):
    # board: dict with 'ships' and 'shots_received'
    for ship in board['ships']:
        if not all(tuple(pos) in board['shots_received'] for pos in ship['positions']):
            return False
    return True

def validate_ships(ships):
    # Kiểm tra số lượng từng loại tàu
    occupied = set()
    for rule in SHIP_RULES:
        found = [s for s in ships if s.get("type") == rule["type"]]
        if len(found) != rule["count"]:
            return False, f"Thiếu hoặc thừa tàu loại {rule['type']}!"
        for ship in found:
            positions = ship.get("positions", [])
            if len(positions) != rule["size"]:
                return False, f"Mỗi tàu {rule['type']} phải có {rule['size']} ô!"
            for pos in positions:
                if not (0 <= pos[0] < BOARD_SIZE and 0 <= pos[1] < BOARD_SIZE):
                    return False, f"Tàu {rule['type']} ra ngoài biên bàn cờ!"
                if tuple(pos) in occupied:
                    return False, f"Tàu {rule['type']} bị chồng lên tàu khác!"
                occupied.add(tuple(pos))
    # Kiểm tra có thừa loại tàu không hợp lệ
    allowed_types = {rule["type"] for rule in SHIP_RULES}
    for ship in ships:
        if ship.get("type") not in allowed_types:
            return False, f"Loại tàu không hợp lệ: {ship.get('type')}"
    return True, "OK"

def save_game_history():
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(game_history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[HISTORY] Lỗi ghi file: {e}")

def record_match_result(game_id, reason, winner_id=None):
    g = games.get(game_id)
    if not g:
        return
    player_ids = g.get('players', [])
    if len(player_ids) < 2:
        return
    p1_id, p2_id = player_ids[0], player_ids[1]
    p1_name = players.get(p1_id, {}).get('name', 'Player 1')
    p2_name = players.get(p2_id, {}).get('name', 'Player 2')
    p1_fleet = players.get(p1_id, {}).get('fleet', 'modern')
    p2_fleet = players.get(p2_id, {}).get('fleet', 'modern')
    winner_name = players.get(winner_id, {}).get('name') if winner_id else None

    # Lập chi tiết bàn cờ an toàn sau khi trận đấu kết thúc
    boards_data = {}
    for cid in player_ids:
        b = g.get('boards', {}).get(cid, {})
        boards_data[cid] = {
            'player_name': players.get(cid, {}).get('name', ''),
            'fleet': players.get(cid, {}).get('fleet', 'modern'),
            'ships': b.get('ships', []),
            'shots_received': [list(pos) for pos in b.get('shots_received', [])]
        }

    details = {
        'boards': boards_data,
        'reason': reason
    }

    # 1. Fallback ghi vào game_history.json
    game_history.append({
        "game_id": game_id,
        "players": [p1_name, p2_name],
        "winner": winner_name,
        "reason": reason,
        "timestamp": datetime.now().isoformat(),
    })
    save_game_history()

    # 2. Bất đồng bộ lưu vào PostgreSQL (Non-blocking)
    asyncio.create_task(db.record_game(
        game_id=game_id,
        player1_name=p1_name,
        player2_name=p2_name,
        winner_name=winner_name,
        player1_fleet=p1_fleet,
        player2_fleet=p2_fleet,
        reason=reason,
        details=details
    ))

async def start_turn_timeout(game_id):
    game = games.get(game_id)
    if not game or game['status'] != 'playing':
        return
    turn = game['turn']
    print(f"[TIMEOUT] Bắt đầu đếm ngược cho {turn}")
    try:
        await asyncio.sleep(TURN_TIMEOUT)
        # Nếu sau timeout vẫn chưa đổi lượt, xử thua
        if game['turn'] == turn and game['status'] == 'playing':
            opponent = [p for p in game['players'] if p != turn][0]
            await broadcast(game['players'], {
                "type": "game_over",
                "data": {
                    "winner": opponent,
                    "message": f"{players[opponent]['name']} thắng vì đối thủ hết thời gian!"
                }
            })
            game['status'] = 'finished'
            record_match_result(game_id, "timeout", opponent)
    except Exception as e:
        print(f"[TIMEOUT] Lỗi: {e}")

async def handler(websocket, path=None):
    if path is None:
        try:
            path = getattr(getattr(websocket, 'request', None), 'path', '/ws/')
        except Exception:
            path = '/ws/'
    print(f"[DEBUG] New connection: path={path}")
    if path and path not in ("/ws/", "/ws", "/"):
        await websocket.close()
        print(f"❌ Wrong path: {path}")
        return
    client_id = str(uuid.uuid4())
    clients[client_id] = websocket
    print(f"👤 Client {client_id} connected at /ws/")
    try:
        await websocket.send(json.dumps({
            "type": "connection_success",
            "data": {
                "client_id": client_id,
                "message": "Kết nối thành công đến Battle Ship Server!"
            }
        }))
        print(f"[DEBUG] Sent connection_success to {client_id}")
        async for message in websocket:
            print(f"[DEBUG] Received from {client_id}: {message}")
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                msg_data = data.get("data", {})
                # Xử lý join_queue
                if msg_type == "join_queue":
                    player_name = msg_data.get("player_name", "")
                    fleet = msg_data.get("fleet", "modern")
                    players[client_id] = {
                        "name": player_name,
                        "fleet": fleet,
                        "websocket": websocket,
                        "ships": [],
                        "ready": False,
                        "shots": []
                    }
                    if client_id not in queue:
                        queue.append(client_id)
                    # Tạo hoặc cập nhật thông tin user trong DB (chạy ngầm, không block)
                    asyncio.create_task(db.get_or_create_user(player_name, fleet))
                    print(f"[QUEUE] {player_name} [{fleet}] ({client_id}) vào hàng chờ. Queue: {queue}")
                    # Nếu đủ 2 người, ghép trận
                    if len(queue) >= 2:
                        p1, p2 = queue.pop(0), queue.pop(0)
                        game_id = str(uuid.uuid4())
                        games[game_id] = {
                            "players": [p1, p2],
                            "boards": {
                                p1: {"ships": [], "shots_received": []},
                                p2: {"ships": [], "shots_received": []}
                            },
                            "turn": random.choice([p1, p2]),
                            "status": "placing",
                            "timeout_task": None
                        }
                        print(f"[GAME] Ghép trận: {p1} vs {p2} (game_id={game_id})")
                        player_names = {cid: players[cid]["name"] for cid in [p1, p2]}
                        player_fleets = {cid: players[cid].get("fleet", "modern") for cid in [p1, p2]}
                        # Gửi cho p1
                        await send(p1, {
                            "type": "start_game",
                            "data": {
                                "game_id": game_id,
                                "room_id": game_id,
                                "opponent": players[p2]["name"],
                                "player_names": player_names,
                                "player_fleets": player_fleets,
                                "message": "Đã ghép trận! Bắt đầu đặt tàu."
                            }
                        })
                        # Gửi cho p2
                        await send(p2, {
                            "type": "start_game",
                            "data": {
                                "game_id": game_id,
                                "room_id": game_id,
                                "opponent": players[p1]["name"],
                                "player_names": player_names,
                                "player_fleets": player_fleets,
                                "message": "Đã ghép trận! Bắt đầu đặt tàu."
                            }
                        })
                    else:
                        await send(client_id, {
                            "type": "queue_joined",
                            "data": {
                                "position": len(queue),
                                "message": "Đang tìm đối thủ..."
                            }
                        })
                # Xử lý đặt tàu
                elif msg_type == "place_ships":
                    game_id = None
                    for gid, g in games.items():
                        if client_id in g['players']:
                            game_id = gid
                            break
                    if not game_id:
                        await send(client_id, {"type": "error", "data": {"message": "Bạn chưa ở trong trận nào!"}})
                        continue
                    ships = msg_data.get("ships", [])
                    # Kiểm tra hợp lệ vị trí tàu
                    valid, reason = validate_ships(ships)
                    if not valid:
                        print(f"[ERROR] Đặt tàu không hợp lệ cho client {client_id}: {reason}")
                        await send(client_id, {"type": "error", "data": {"message": reason}})
                        continue
                    games[game_id]['boards'][client_id]['ships'] = ships
                    players[client_id]['ships'] = ships
                    players[client_id]['ready'] = True
                    print(f"[GAME] {client_id} đã đặt tàu xong cho game {game_id}")
                    # Nếu cả 2 đã đặt xong
                    if all_ships_placed(game_id):
                        games[game_id]['status'] = 'playing'
                        turn = games[game_id]['turn']
                        # Bắt đầu timeout cho lượt đầu tiên
                        games[game_id]['timeout_task'] = asyncio.create_task(start_turn_timeout(game_id))
                        await broadcast(games[game_id]['players'], {
                            "type": "game_update",
                            "data": {
                                "message": "Cả 2 đã đặt tàu xong! Bắt đầu chơi.",
                                "turn": turn,
                                "status": "playing",
                                "timeout": TURN_TIMEOUT
                            }
                        })
                # Xử lý bắn
                elif msg_type == "fire_shot":
                    game_id = None
                    for gid, g in games.items():
                        if client_id in g['players']:
                            game_id = gid
                            break
                    if not game_id:
                        await send(client_id, {"type": "error", "data": {"message": "Bạn chưa ở trong trận nào!"}})
                        continue
                    game = games[game_id]
                    if game['status'] != 'playing':
                        await send(client_id, {"type": "error", "data": {"message": "Trận chưa bắt đầu hoặc đã kết thúc!"}})
                        continue
                    if game['turn'] != client_id:
                        await send(client_id, {"type": "error", "data": {"message": "Chưa đến lượt bạn!"}})
                        continue
                    row, col = msg_data.get("row"), msg_data.get("col")
                    opponent = [p for p in game['players'] if p != client_id][0]
                    board = game['boards'][opponent]
                    shot = (row, col)
                    if shot in board['shots_received']:
                        await send(client_id, {"type": "error", "data": {"message": "Ô này đã bắn rồi!"}})
                        continue
                    board['shots_received'].append(shot)
                    players[client_id]['shots'].append(shot)
                    # Kiểm tra trúng tàu
                    hit = False
                    sunk = False
                    sunk_ship_data = None
                    for ship in board['ships']:
                        positions = [tuple(pos) for pos in ship['positions']]
                        if shot in positions:
                            hit = True
                            # Kiểm tra chìm tàu
                            if all(pos in board['shots_received'] for pos in positions):
                                sunk = True
                                sunk_ship_data = {
                                    "type": ship.get("type"),
                                    "positions": ship.get("positions"),
                                    "fleet": players[opponent].get("fleet", "modern")
                                }
                            break
                    # Kiểm tra thắng/thua
                    win = check_all_ships_sunk(board)
                    if win:
                        game['status'] = 'finished'
                    # Hủy timeout cũ
                    if game.get('timeout_task'):
                        game['timeout_task'].cancel()
                    # Xác định lượt tiếp theo
                    if not win:
                        if hit:
                            next_turn = client_id  # Bắn trúng, được bắn tiếp
                        else:
                            next_turn = opponent  # Bắn trượt, chuyển lượt
                        game['turn'] = next_turn
                    else:
                        next_turn = None
                    # Gửi cập nhật cho cả 2
                    player_names = {cid: players[cid]["name"] for cid in game['players']}
                    player_fleets = {cid: players[cid].get("fleet", "modern") for cid in game['players']}
                    await broadcast(game['players'], {
                        "type": "game_update",
                        "data": {
                            "shot": {"row": row, "col": col},
                            "by": client_id,
                            "hit": hit,
                            "sunk": sunk,
                            "sunk_ship": sunk_ship_data,
                            "turn": next_turn,
                            "status": game['status'],
                            "winner": client_id if win else None,
                            "timeout": TURN_TIMEOUT if not win else None,
                            "player_names": player_names,
                            "player_fleets": player_fleets,
                            "room_id": game_id
                        }
                    })
                    if win:
                        await broadcast(game['players'], {
                            "type": "game_over",
                            "data": {
                                "winner": client_id,
                                "message": f"{players[client_id]['name']} đã thắng trận!",
                                "room_id": game_id,
                                "player_names": player_names
                            }
                        })
                        record_match_result(game_id, "win", client_id)
                    else:
                        # Bắt đầu timeout cho lượt mới
                        game['timeout_task'] = asyncio.create_task(start_turn_timeout(game_id))
                # Xử lý chat
                elif msg_type == "chat_message":
                    game_id = None
                    for gid, g in games.items():
                        if client_id in g['players']:
                            game_id = gid
                            break
                    if game_id:
                        await broadcast(games[game_id]['players'], {
                            "type": "chat_message",
                            "data": {
                                "sender": players[client_id]['name'],
                                "message": msg_data.get("message", ""),
                                "timestamp": int(datetime.now().timestamp()),
                                "room_id": game_id
                            }
                        })
                # Xử lý đầu hàng
                elif msg_type == "surrender":
                    game_id = None
                    for gid, g in games.items():
                        if client_id in g['players']:
                            game_id = gid
                            break
                    if game_id:
                        opponent = [p for p in games[game_id]['players'] if p != client_id][0]
                        await broadcast(games[game_id]['players'], {
                            "type": "game_over",
                            "data": {
                                "winner": opponent,
                                "message": f"{players[opponent]['name']} đã thắng vì đối thủ đầu hàng!"
                            }
                        })
                        games[game_id]['status'] = 'finished'
                        record_match_result(game_id, "surrender", opponent)
                # Lấy Bảng xếp hạng từ PostgreSQL
                elif msg_type == "get_leaderboard":
                    limit = int(msg_data.get("limit", 10))
                    lb = await db.get_leaderboard(limit)
                    await websocket.send(json.dumps({
                        "type": "leaderboard_data",
                        "data": lb
                    }))
                # Lấy Lịch sử trận đấu
                elif msg_type == "get_history":
                    limit = int(msg_data.get("limit", 20))
                    history = await db.get_recent_games(limit)
                    if not history and game_history:
                        history = list(reversed(game_history))[:limit]
                    await websocket.send(json.dumps({
                        "type": "history_data",
                        "data": history
                    }))
                else:
                    # Echo lại các message khác (giữ nguyên logic cũ)
                    await websocket.send(json.dumps({
                        "type": "echo",
                        "data": data
                    }))
                    print(f"[DEBUG] Echoed message to {client_id}")
            except Exception as e:
                print(f"❌ Lỗi xử lý message: {e}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "data": {"message": str(e)}
                }))
    except websockets.ConnectionClosed as e:
        print(f"🔌 Client {client_id} ngắt kết nối: {e}")
    except Exception as e:
        print(f"❌ Exception in handler for {client_id}: {e}")
    finally:
        print(f"[DEBUG] Client {client_id} disconnected")
        client_name = players.get(client_id, {}).get('name', 'Đối thủ')
        if client_id in queue:
            queue.remove(client_id)
        # Xử lý các ván game đang diễn ra: Xử thua ngay lập tức nếu đối thủ ngắt kết nối
        for gid, g in list(games.items()):
            if client_id in g['players']:
                if g['status'] != 'finished':
                    opponent = [p for p in g['players'] if p != client_id][0]
                    g['status'] = 'finished'
                    player_names = {cid: players.get(cid, {}).get("name", cid) for cid in g['players']}
                    player_names[client_id] = client_name
                    # Gửi thông báo chiến thắng ngay lập tức cho người chơi còn lại
                    await send(opponent, {
                        "type": "game_over",
                        "data": {
                            "winner": opponent,
                            "message": f"{client_name} đã mất kết nối! Bạn được xử thắng ván đấu này.",
                            "room_id": gid,
                            "reason": "disconnect",
                            "player_names": player_names
                        }
                    })
                    record_match_result(gid, "disconnect", opponent)
                # Hủy timeout nếu còn
                if g.get('timeout_task'):
                    g['timeout_task'].cancel()
                del games[gid]
        clients.pop(client_id, None)
        players.pop(client_id, None)

async def main():
    # Khởi tạo kết nối PostgreSQL (có Graceful Fallback)
    await db.init_db()

    # Load lịch sử file nếu có
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                global game_history
                game_history = json.load(f)
        except Exception as e:
            print(f"[HISTORY] Lỗi đọc file: {e}")

    host = os.getenv("BATTLESHIP_HOST", "0.0.0.0")
    port = int(os.getenv("BATTLESHIP_PORT", "8888"))
    print(f"🚢 WebSocket Battle Ship Server đang chạy tại ws://{host}:{port}/ws/")
    try:
        async with websockets.serve(handler, host, port):
            await asyncio.Future()  # Run forever
    finally:
        await db.close_db()

if __name__ == "__main__":
    asyncio.run(main()) 