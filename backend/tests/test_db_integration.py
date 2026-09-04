import asyncio
import json
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend import db

async def run_db_tests():
    print("=== [TEST 1] Testing DB Connection & Table Creation ===")
    connected = await db.init_db()
    assert connected, "init_db() failed to connect to PostgreSQL"
    assert db.pool is not None, "db.pool should not be None"
    print("-> OK: PostgreSQL connected and tables initialized!")

    suffix = uuid.uuid4().hex[:6]
    u1_name = f"Vance_{suffix}"
    u2_name = f"Sterling_{suffix}"

    print("\n=== [TEST 2] Testing User Creation & Update ===")
    u1 = await db.get_or_create_user(u1_name, "modern")
    u2 = await db.get_or_create_user(u2_name, "vintage")
    assert u1["username"] == u1_name, f"Unexpected user: {u1}"
    assert u2["username"] == u2_name, f"Unexpected user: {u2}"
    print(f"-> OK: Created users {u1['username']} (Elo: {u1['elo']}) & {u2['username']} (Elo: {u2['elo']})")

    print("\n=== [TEST 3] Testing Match Recording & Elo Calculation ===")
    game_id = str(uuid.uuid4())
    match_details = {
        "boards": {
            "p1": {"fleet": "modern", "ships": [{"type": "Destroyer", "positions": [[0, 0], [0, 1]]}]},
            "p2": {"fleet": "vintage", "ships": [{"type": "Destroyer", "positions": [[1, 0], [1, 1]]}]}
        },
        "shots_count": 5
    }
    saved = await db.record_game(
        game_id=game_id,
        player1_name=u1_name,
        player2_name=u2_name,
        winner_name=u1_name,
        player1_fleet="modern",
        player2_fleet="vintage",
        reason="win",
        details=match_details
    )
    assert saved, "record_game failed"
    print(f"-> OK: Game {game_id} recorded in PostgreSQL with JSONB details!")

    print("\n=== [TEST 4] Testing Leaderboard & Stats Query ===")
    lb = await db.get_leaderboard(10)
    assert len(lb) >= 2, f"Leaderboard should have at least 2 entries: {lb}"
    # Vance won (+25 elo -> 1025, 1 win)
    vance = next((u for u in lb if u["username"] == u1_name), None)
    assert vance is not None, "Vance not in leaderboard"
    assert vance["elo"] == 1025, f"Expected 1025 elo, got {vance['elo']}"
    assert vance["wins"] == 1, f"Expected 1 win, got {vance['wins']}"

    # Sterling lost (-20 elo -> 980, 1 loss)
    sterling = next((u for u in lb if u["username"] == u2_name), None)
    assert sterling is not None, "Sterling not in leaderboard"
    assert sterling["elo"] == 980, f"Expected 980 elo, got {sterling['elo']}"
    assert sterling["losses"] == 1, f"Expected 1 loss, got {sterling['losses']}"
    print("-> OK: Leaderboard verified:")
    for rank, entry in enumerate(lb[:5], 1):
        print(f"   #{rank} {entry['username']} - Elo: {entry['elo']} | Win/Loss: {entry['wins']}/{entry['losses']} ({entry['win_rate']}%)")

    print("\n=== [TEST 5] Testing Recent Games Query ===")
    recent = await db.get_recent_games(5)
    assert any(g["id"] == game_id for g in recent), f"Recent games should contain {game_id}"
    print(f"-> OK: Found game {game_id} in recent games list!")

    await db.close_db()
    print("\n🎉 ALL POSTGRESQL DATABASE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_db_tests())
