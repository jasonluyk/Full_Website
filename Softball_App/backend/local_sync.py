"""
local_sync.py — Runs on your LOCAL machine (not the droplet)
Scrapes ALL active Top Gun tournaments and pushes to MongoDB Atlas.
The droplet frontend reads from the same MongoDB.

Usage:
    python local_sync.py              # sync once
    python local_sync.py --watch      # auto-sync every 2 min
    python local_sync.py --interval 5 # auto-sync every 5 min
"""
import os
import sys
import time
import pymongo
import argparse
from dotenv import load_dotenv
from pathlib import Path
from scraper import scrape_tournament

load_dotenv(Path(__file__).parent / '.env')

client = pymongo.MongoClient(os.environ.get('MONGO_URI'))
db = client['softball_db']


def sync_all():
    """Scrape all active tournaments and push to MongoDB."""
    active_list = list(db['active_tournaments'].find({}))
    if not active_list:
        print("No active tournaments. Add them in Admin first.")
        return False

    print(f"🥎 Syncing {len(active_list)} tournament(s)...")
    success = 0
    for active in active_list:
        trnid = active.get('trnid')
        division = active.get('division')
        name = active.get('name', trnid)
        print(f"\n  📍 {name} (trnid={trnid})")

        try:
            divisions = scrape_tournament(trnid, division)
            if not divisions:
                print(f"    ⚠️ No data — possibly blocked or schedule not posted")
                continue
            for div in divisions:
                db['tournament_data'].replace_one(
                    {'trnid': trnid, 'name': div['name']},
                    {'trnid': trnid, **div},
                    upsert=True
                )
            print(f"    ✅ Synced {len(divisions)} division(s): {[d['name'] for d in divisions]}")
            success += 1
        except Exception as e:
            print(f"    ⚠️ Error: {e}")

    print(f"\n✅ Synced {success}/{len(active_list)} tournaments")
    return success > 0


def watch_mode(interval_minutes=2):
    """Continuously sync every N minutes."""
    print(f"👀 Watch mode — syncing every {interval_minutes} min. Ctrl+C to stop.")
    print("=" * 60)
    while True:
        sync_all()
        print(f"\n  ⏳ Next sync in {interval_minutes} min...")
        time.sleep(interval_minutes * 60)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true', help='Auto-sync mode')
    parser.add_argument('--interval', type=int, default=2, help='Minutes between syncs')
    args = parser.parse_args()

    if args.watch:
        watch_mode(args.interval)
    else:
        sync_all()