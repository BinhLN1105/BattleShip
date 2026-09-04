import asyncio
import json
import websockets
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend import ws_server, db

async def run_e2e():
    print("=== [E2E] Starting WebSocket Server with PostgreSQL ===")
    await db.init_db()

    server = await websockets.serve(ws_server.handler, "127.0.0.1", 8889)
    print("-> Server running at ws://127.0.0.1:8889/ws/")

    try:
        # Client 1: Admiral_Nova (scifi)
        ws1 = await websockets.connect("ws://127.0.0.1:8889/ws/")
        init1 = json.loads(await ws1.recv())
        assert init1["type"] == "connection_success"

        # Client 2: Captain_Vance (modern)
        ws2 = await websockets.connect("ws://127.0.0.1:8889/ws/")
        init2 = json.loads(await ws2.recv())
        assert init2["type"] == "connection_success"

        # Client 1 joins queue
        await ws1.send(json.dumps({
            "type": "join_queue",
            "data": {"player_name": "Admiral_Nova", "fleet": "scifi"}
        }))
        q1 = json.loads(await ws1.recv())
        assert q1["type"] == "queue_joined"

        # Client 2 joins queue -> game match triggers
        await ws2.send(json.dumps({
            "type": "join_queue",
            "data": {"player_name": "Captain_Vance", "fleet": "modern"}
        }))

        start1 = json.loads(await ws1.recv())
        start2 = json.loads(await ws2.recv())
        assert start1["type"] == "start_game"
        assert start2["type"] == "start_game"
        game_id = start1["data"]["game_id"]
        print(f"-> OK: Match created: {game_id}")

        # Place ships
        test_ships = [
            {"type": "Destroyer", "positions": [[0, 0], [0, 1]]},
            {"type": "Submarine", "positions": [[1, 0], [1, 1], [1, 2]]},
            {"type": "Submarine", "positions": [[2, 0], [2, 1], [2, 2]]},
            {"type": "Cruiser", "positions": [[3, 0], [3, 1], [3, 2], [3, 3]]},
            {"type": "Battleship", "positions": [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]]}
        ]

        await ws1.send(json.dumps({"type": "place_ships", "data": {"ships": test_ships}}))
        await ws2.send(json.dumps({"type": "place_ships", "data": {"ships": test_ships}}))

        # Both receive game_update (status = playing)
        gstart1 = json.loads(await ws1.recv())
        gstart2 = json.loads(await ws2.recv())
        assert gstart1["type"] == "game_update"
        assert gstart1["data"]["status"] == "playing"
        print("-> OK: Both players placed ships and game started!")

        # Client 2 surrenders
        await ws2.send(json.dumps({"type": "surrender", "data": {}}))
        over1 = json.loads(await ws1.recv())
        over2 = json.loads(await ws2.recv())
        assert over1["type"] == "game_over"
        print("-> OK: Surrender processed and game_over sent!")

        # Wait a moment for background DB recording task to complete
        await asyncio.sleep(0.5)

        # Query leaderboard via WebSocket from Client 1
        await ws1.send(json.dumps({"type": "get_leaderboard", "data": {"limit": 5}}))
        lb_res = json.loads(await ws1.recv())
        assert lb_res["type"] == "leaderboard_data"
        print(f"-> OK: WebSocket Leaderboard query returned {len(lb_res['data'])} players:")
        for r, p in enumerate(lb_res["data"], 1):
            print(f"   #{r} {p['username']} - Elo: {p['elo']} (Fleet: {p['fleet_preference']})")

        # Query history via WebSocket from Client 2
        await ws2.send(json.dumps({"type": "get_history", "data": {"limit": 5}}))
        hist_res = json.loads(await ws2.recv())
        assert hist_res["type"] == "history_data"
        print(f"-> OK: WebSocket History query returned {len(hist_res['data'])} games!")

        await ws1.close()
        await ws2.close()

    finally:
        server.close()
        await server.wait_closed()
        await db.close_db()
        print("-> Server and DB closed cleanly.")

if __name__ == "__main__":
    asyncio.run(run_e2e())
