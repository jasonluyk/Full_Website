"""
test_sim.py — Simulates a tournament day by injecting fake scores
in time order every 5 minutes. Run this instead of the real scraper
to test the UI update flow.

Usage: python test_sim.py
"""
import os
import time
import random
import pymongo
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

client = pymongo.MongoClient(os.environ.get('MONGO_URI'))
db = client['softball_db']

# ── Seed the tournament with the real 10U BB#2 roster ─────────────────
TEAMS = [
    {"seed": "1",  "team": "Carolina Icebreakers",           "location": "Marshville, NC"},
    {"seed": "2",  "team": "NC Valkyries Fastpitch Softball", "location": "Huntersville, NC"},
    {"seed": "3",  "team": "Copperhead Softball",             "location": "Chesterfield, SC"},
    {"seed": "4",  "team": "LKN Havoc",                      "location": "Huntersville, NC"},
    {"seed": "5",  "team": "Carolina Wombats 10U- Gray",      "location": "Waxhaw, NC"},
    {"seed": "6",  "team": "Legacy 10u-Allen",                "location": "Fort Mill, SC"},
    {"seed": "7",  "team": "Lady Warriors '16",               "location": "Mint Hill, NC"},
    {"seed": "8",  "team": "10U ALAB SOFTBALL",               "location": "Maiden, NC"},
    {"seed": "9",  "team": "Burke Fury",                      "location": "Morganton, NC"},
    {"seed": "10", "team": "Carolina Lightning",              "location": "Lancaster, SC"},
]

POOL_GAMES = [
    {"game": "1",  "day": "Sat", "time": "9:00 AM",  "field": "C. Creek:Field # 4", "team_a": "Carolina Wombats 10U- Gray",      "team_b": "Legacy 10u-Allen"},
    {"game": "2",  "day": "Sat", "time": "10:00 AM", "field": "C. Creek:Field # 1", "team_a": "Carolina Icebreakers",           "team_b": "NC Valkyries Fastpitch Softball"},
    {"game": "3",  "day": "Sat", "time": "10:00 AM", "field": "C. Creek:Field # 2", "team_a": "Copperhead Softball",            "team_b": "LKN Havoc"},
    {"game": "4",  "day": "Sat", "time": "10:15 AM", "field": "C. Creek:Field # 4", "team_a": "Lady Warriors '16",              "team_b": "10U ALAB SOFTBALL"},
    {"game": "5",  "day": "Sat", "time": "11:15 AM", "field": "C. Creek:Field # 1", "team_a": "Carolina Icebreakers",           "team_b": "Carolina Lightning"},
    {"game": "6",  "day": "Sat", "time": "11:15 AM", "field": "C. Creek:Field # 2", "team_a": "Copperhead Softball",            "team_b": "Burke Fury"},
    {"game": "7",  "day": "Sat", "time": "11:30 AM", "field": "C. Creek:Field # 4", "team_a": "Carolina Wombats 10U- Gray",     "team_b": "Lady Warriors '16"},
    {"game": "8",  "day": "Sat", "time": "12:30 PM", "field": "C. Creek:Field # 1", "team_a": "NC Valkyries Fastpitch Softball","team_b": "Carolina Lightning"},
    {"game": "9",  "day": "Sat", "time": "12:30 PM", "field": "C. Creek:Field # 2", "team_a": "LKN Havoc",                     "team_b": "Burke Fury"},
    {"game": "10", "day": "Sat", "time": "12:45 PM", "field": "C. Creek:Field # 4", "team_a": "Legacy 10u-Allen",               "team_b": "10U ALAB SOFTBALL"},
]

GOLD_BRACKET = [
    {"game": "1", "day": "Sat", "time": "2:30 PM", "field": "C. Creek:Field # 1", "team_a": "Seed #4", "team_b": "Seed #5"},
    {"game": "2", "day": "Sat", "time": "2:30 PM", "field": "C. Creek:Field # 4", "team_a": "Seed #2", "team_b": "Seed #3"},
    {"game": "3", "day": "Sat", "time": "4:00 PM", "field": "C. Creek:Field # 1", "team_a": "Winner Game #1", "team_b": "Seed #1"},
    {"game": "4", "day": "Sat", "time": "5:30 PM", "field": "C. Creek:Field # 1", "team_a": "Winner Game #2", "team_b": "Winner Game #3"},
]

SILVER_BRACKET = [
    {"game": "1", "day": "Sat", "time": "2:30 PM", "field": "C. Creek:Field # 2", "team_a": "Seed #9",  "team_b": "Seed #10"},
    {"game": "2", "day": "Sat", "time": "4:00 PM", "field": "C. Creek:Field # 4", "team_a": "Seed #7",  "team_b": "Seed #8"},
    {"game": "3", "day": "Sat", "time": "4:00 PM", "field": "C. Creek:Field # 2", "team_a": "Winner Game #1", "team_b": "Seed #6"},
    {"game": "4", "day": "Sat", "time": "5:30 PM", "field": "C. Creek:Field # 2", "team_a": "Winner Game #2", "team_b": "Winner Game #3"},
]

def random_score():
    """Generate a realistic softball score pair."""
    a = random.randint(0, 12)
    b = random.randint(0, 12)
    while a == b:  # avoid ties in regular games for simplicity
        b = random.randint(0, 12)
    return str(a), str(b)

def update_standings(pool_games):
    """Recalculate W/L/RS/RA from completed pool games."""
    stats = {t["team"]: {"won": 0.0, "lost": 0.0, "runs_scored": 0, "runs_allowed": 0} for t in TEAMS}

    for g in pool_games:
        if not g.get("complete"):
            continue
        sa, sb = int(g["score_a"]), int(g["score_b"])
        ta, tb = g["team_a"], g["team_b"]
        if ta in stats:
            if sa > sb:
                stats[ta]["won"] += 1
            else:
                stats[ta]["lost"] += 1
            stats[ta]["runs_scored"] += sa
            stats[ta]["runs_allowed"] += sb
        if tb in stats:
            if sb > sa:
                stats[tb]["won"] += 1
            else:
                stats[tb]["lost"] += 1
            stats[tb]["runs_scored"] += sb
            stats[tb]["runs_allowed"] += sa

    standings = []
    for t in TEAMS:
        s = stats[t["team"]]
        standings.append({**t, **s})
    return standings

def seed_teams(standings, pool_games):
    """Apply seeding rules and return ordered list."""
    h2h = {}
    for g in pool_games:
        if not g.get("complete"):
            continue
        sa, sb = int(g["score_a"]), int(g["score_b"])
        ta, tb = g["team_a"], g["team_b"]
        if ta not in h2h: h2h[ta] = {}
        if tb not in h2h: h2h[tb] = {}
        if tb not in h2h[ta]: h2h[ta][tb] = {"wins": 0}
        if ta not in h2h[tb]: h2h[tb][ta] = {"wins": 0}
        if sa > sb: h2h[ta][tb]["wins"] += 1
        else: h2h[tb][ta]["wins"] += 1

    def sort_key(t):
        return (-t["won"], t["lost"], t["runs_allowed"], -t["runs_scored"])

    return sorted(standings, key=sort_key)

def resolve_bracket_teams(bracket_games, seeded_standings):
    """Replace Seed #N placeholders with actual team names."""
    seed_map = {i+1: t["team"] for i, t in enumerate(seeded_standings)}
    winner_map = {}
    resolved = []

    for g in bracket_games:
        ta = g["team_a"]
        tb = g["team_b"]

        # Resolve seed placeholders
        seed_match = re.match(r'Seed #(\d+)', ta)
        if seed_match:
            ta = seed_map.get(int(seed_match.group(1)), ta)

        seed_match = re.match(r'Seed #(\d+)', tb)
        if seed_match:
            tb = seed_map.get(int(seed_match.group(1)), tb)

        # Resolve winner placeholders
        win_match = re.match(r'Winner Game #(\d+)', ta)
        if win_match:
            ta = winner_map.get(int(win_match.group(1)), ta)

        win_match = re.match(r'Winner Game #(\d+)', tb)
        if win_match:
            tb = winner_map.get(int(win_match.group(1)), tb)

        ng = {**g, "team_a": ta, "team_b": tb, "score_a": None, "score_b": None, "complete": False}

        # If this game has a score, record winner
        if g.get("score_a") and g.get("score_b"):
            ng["score_a"] = g["score_a"]
            ng["score_b"] = g["score_b"]
            ng["complete"] = True
            sa, sb = int(g["score_a"]), int(g["score_b"])
            winner_map[int(g["game"])] = ta if sa > sb else tb

        resolved.append(ng)

    return resolved

import re

def save_state(standings, pool_games, gold_games, silver_games, phase):
    """Save current tournament state to MongoDB."""
    db["active_tournament"].replace_one(
        {"type": "current"},
        {"type": "current", "trnid": "SIM", "division": "10U : BB#2"},
        upsert=True
    )
    db["tournament_data"].replace_one(
        {"trnid": "SIM", "name": "10U : BB#2"},
        {
            "trnid": "SIM",
            "name": "10U : BB#2",
            "standings": standings,
            "pool_play": pool_games,
            "brackets": [
                {"name": "Gold Bracket", "games": gold_games},
                {"name": "Silver Bracket", "games": silver_games},
            ]
        },
        upsert=True
    )
    print(f"  ✅ Saved state: {phase}")

def run_simulation():
    import random

    print("🥎 Starting tournament simulation for 10U : BB#2")
    print("=" * 50)

    pool_games = [dict(g, score_a=None, score_b=None, complete=False) for g in POOL_GAMES]
    gold_games = [dict(g, score_a=None, score_b=None, complete=False) for g in GOLD_BRACKET]
    silver_games = [dict(g, score_a=None, score_b=None, complete=False) for g in SILVER_BRACKET]

    # Group pool games by time slot
    time_slots = {}
    for g in pool_games:
        t = g["time"]
        if t not in time_slots:
            time_slots[t] = []
        time_slots[t].append(g["game"])

    # Initial state — no scores
    standings = update_standings(pool_games)
    seeded = seed_teams(standings, pool_games)
    save_state(seeded, pool_games, gold_games, silver_games, "Pre-tournament (no scores)")
    print(f"\n⏳ Waiting 5 seconds before Round 1...")
    time.sleep(10)

    # Simulate each time slot
    for slot_time, game_nums in sorted(time_slots.items(), key=lambda x: x[0]):
        print(f"\n⏰ Scoring games at {slot_time}...")
        for gnum in game_nums:
            for g in pool_games:
                if g["game"] == gnum:
                    sa, sb = random_score()
                    g["score_a"] = sa
                    g["score_b"] = sb
                    g["complete"] = True
                    print(f"   Game {gnum}: {g['team_a']} {sa} - {sb} {g['team_b']}")

        standings = update_standings(pool_games)
        seeded = seed_teams(standings, pool_games)
        save_state(seeded, pool_games, gold_games, silver_games, f"After {slot_time} games")
        print(f"   Current top 3: {seeded[0]['team']} | {seeded[1]['team']} | {seeded[2]['team']}")
        print(f"   ⏳ Next update in 4 minutes...")
        time.sleep(240)

    # All pool play done — populate brackets with real team names
    print("\n🏆 Pool play complete! Populating brackets...")
    seeded = seed_teams(standings, pool_games)

    resolved_gold = resolve_bracket_teams(GOLD_BRACKET, seeded)
    resolved_silver = resolve_bracket_teams(SILVER_BRACKET, seeded)
    save_state(seeded, pool_games, resolved_gold, resolved_silver, "Brackets seeded")
    print("   ⏳ Waiting 4 minutes before bracket games...")
    time.sleep(240)

    # Simulate bracket games in rounds
    def sim_bracket(bracket_games, name):
        for g in bracket_games:
            if g["team_a"].startswith("Winner") or g["team_b"].startswith("Winner"):
                continue  # skip until previous round resolves
            sa, sb = random_score()
            g["score_a"] = sa
            g["score_b"] = sb
            g["complete"] = True
            print(f"   [{name}] Game {g['game']}: {g['team_a']} {sa} - {sb} {g['team_b']}")

    print(f"\n⚾ Bracket Round 1...")
    sim_bracket(resolved_gold, "Gold")
    sim_bracket(resolved_silver, "Silver")
    save_state(seeded, pool_games, resolved_gold, resolved_silver, "Bracket Round 1")
    print("   ⏳ Next update in 4 minutes...")
    time.sleep(240)

    print(f"\n⚾ Bracket Semis...")
    # Resolve winners and sim semi games
    for bracket in [resolved_gold, resolved_silver]:
        winner_map = {}
        for g in bracket:
            if g.get("complete"):
                sa, sb = int(g["score_a"]), int(g["score_b"])
                winner_map[int(g["game"])] = g["team_a"] if sa > sb else g["team_b"]
        for g in bracket:
            if g.get("complete"):
                continue
            ta = g["team_a"]
            tb = g["team_b"]
            wm = re.match(r'Winner Game #(\d+)', ta)
            if wm: ta = winner_map.get(int(wm.group(1)), ta)
            wm = re.match(r'Winner Game #(\d+)', tb)
            if wm: tb = winner_map.get(int(wm.group(1)), tb)
            g["team_a"] = ta
            g["team_b"] = tb
            if not ta.startswith("Winner") and not tb.startswith("Winner"):
                sa, sb = random_score()
                g["score_a"] = sa
                g["score_b"] = sb
                g["complete"] = True
                print(f"   Game {g['game']}: {ta} {sa} - {sb} {tb}")

    save_state(seeded, pool_games, resolved_gold, resolved_silver, "Bracket Semis")
    print("   ⏳ Next update in 4 minutes...")
    time.sleep(240)

    print(f"\n🏆 Finals...")
    for bracket in [resolved_gold, resolved_silver]:
        winner_map = {}
        for g in bracket:
            if g.get("complete"):
                sa, sb = int(g["score_a"]), int(g["score_b"])
                winner_map[int(g["game"])] = g["team_a"] if sa > sb else g["team_b"]
        for g in bracket:
            if g.get("complete"):
                continue
            ta = g["team_a"]
            tb = g["team_b"]
            wm = re.match(r'Winner Game #(\d+)', ta)
            if wm: ta = winner_map.get(int(wm.group(1)), ta)
            wm = re.match(r'Winner Game #(\d+)', tb)
            if wm: tb = winner_map.get(int(wm.group(1)), tb)
            g["team_a"] = ta
            g["team_b"] = tb
            sa, sb = random_score()
            g["score_a"] = sa
            g["score_b"] = sb
            g["complete"] = True
            print(f"   🏆 Final: {ta} {sa} - {sb} {tb}")

    save_state(seeded, pool_games, resolved_gold, resolved_silver, "Tournament Complete")
    print("\n✅ Simulation complete! Tournament data saved.")

if __name__ == "__main__":
    run_simulation()