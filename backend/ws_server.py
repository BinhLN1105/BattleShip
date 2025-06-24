import asyncio
import websockets  # type: ignore
import json
import uuid
import random
import os
from datetime import datetime

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
            # Lưu lịch sử
            game_history.append({
                "game_id": game_id,
                "players": [players[p]['name'] for p in game['players']],
                "winner": players[opponent]['name'],
                "reason": "timeout",
                "timestamp": datetime.now().isoformat(),
            })
            save_game_history()
    except Exception as e:
        print(f"[TIMEOUT] Lỗi: {e}")

async def handler(websocket, path):
    print(f"[DEBUG] New connection: path={path}")
    if path != "/ws/":
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
                    players[client_id] = {"name": player_name, "websocket": websocket, "ships": [], "ready": False, "shots": []}
                    if client_id not in queue:
                        queue.append(client_id)
                    print(f"[QUEUE] {player_name} ({client_id}) vào hàng chờ. Queue: {queue}")
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
                        # Gửi cho p1
                        await send(p1, {
                            "type": "start_game",
                            "data": {
                                "game_id": game_id,
                                "room_id": game_id,
                                "opponent": players[p2]["name"],
                                "player_names": player_names,
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
                                "message": "Đã ghép trận! Bắt đầu đặt tàu."
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
                    for ship in board['ships']:
                        positions = [tuple(pos) for pos in ship['positions']]
                        if shot in positions:
                            hit = True
                            # Kiểm tra chìm tàu
                            if all(pos in board['shots_received'] for pos in positions):
                                sunk = True
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
                    await broadcast(game['players'], {
                        "type": "game_update",
                        "data": {
                            "shot": {"row": row, "col": col},
                            "by": client_id,
                            "hit": hit,
                            "sunk": sunk,
                            "turn": next_turn,
                            "status": game['status'],
                            "winner": client_id if win else None,
                            "timeout": TURN_TIMEOUT if not win else None,
                            "player_names": player_names,
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
                        # Lưu lịch sử
                        game_history.append({
                            "game_id": game_id,
                            "players": [players[p]['name'] for p in game['players']],
                            "winner": players[client_id]['name'],
                            "reason": "win",
                            "timestamp": datetime.now().isoformat(),
                        })
                        save_game_history()
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
                        # Lưu lịch sử
                        game_history.append({
                            "game_id": game_id,
                            "players": [players[p]['name'] for p in games[game_id]['players']],
                            "winner": players[opponent]['name'],
                            "reason": "surrender",
                            "timestamp": datetime.now().isoformat(),
                        })
                        save_game_history()
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
        clients.pop(client_id, None)
        players.pop(client_id, None)
        if client_id in queue:
            queue.remove(client_id)
        # Dọn dẹp game nếu cần
        for gid, g in list(games.items()):
            if client_id in g['players']:
                # Lưu lịch sử nếu game chưa kết thúc
                if g['status'] != 'finished':
                    opponent = [p for p in g['players'] if p != client_id][0]
                    game_history.append({
                        "game_id": gid,
                        "players": [players.get(p, {'name': p})['name'] for p in g['players']],
                        "winner": players.get(opponent, {'name': opponent})['name'],
                        "reason": "disconnect",
                        "timestamp": datetime.now().isoformat(),
                    })
                    save_game_history()
                # Hủy timeout nếu còn
                if g.get('timeout_task'):
                    g['timeout_task'].cancel()
                del games[gid]

async def main():
    # Load lịch sử nếu có
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                global game_history
                game_history = json.load(f)
        except Exception as e:
            print(f"[HISTORY] Lỗi đọc file: {e}")
    print("🚢 WebSocket Battle Ship Server đang chạy tại ws://0.0.0.0:8888/ws/")
    async with websockets.serve(handler, "0.0.0.0", 8888):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main()) 