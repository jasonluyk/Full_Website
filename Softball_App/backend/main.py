from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import pymongo
import os
import secrets
import threading
import time
from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager

load_dotenv(Path(__file__).parent / '.env')

# Ensure backend directory is in path for scraper import
import sys
sys.path.insert(0, str(Path(__file__).parent))

# ── Scraper import ───────────────────────────────────────────────────
try:
    from scraper import scrape_tournament
    print("✅ Scraper imported successfully")
except Exception as e:
    print(f"⚠️ Scraper import failed: {e}")
    scrape_tournament = None

# ── Database ──────────────────────────────────────────────────────────
mongo_url = os.environ.get("MONGO_URI")
client = pymongo.MongoClient(mongo_url)
db = client["softball_db"]

# Ensure unique index on trnid + division name
db["tournament_data"].create_index([("trnid", 1), ("name", 1)], unique=True)
db["active_tournaments"].create_index([("trnid", 1)], unique=True)

ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin")

# ── Auth ──────────────────────────────────────────────────────────────
security = HTTPBasic()

def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    ok = secrets.compare_digest(credentials.username, "admin") and \
         secrets.compare_digest(credentials.password, ADMIN_PASS)
    if not ok:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return credentials.username

# ── Background sync ───────────────────────────────────────────────────
_sync_thread = None

def background_sync_loop():
    """Auto-resync all active tournaments every 2 minutes."""
    while True:
        time.sleep(120)
        try:
            active_list = list(db["active_tournaments"].find({}))
            if not active_list:
                continue
            if not scrape_tournament:
                print("⚠️ Scraper not available")
                continue
            for active in active_list:
                trnid = active.get("trnid")
                if not trnid:
                    continue
                div_filter = active.get("division")
                print(f"🔄 Background sync: trnid={trnid} {'(' + div_filter + ')' if div_filter else '(all)'}...")
                try:
                    divisions = scrape_tournament(trnid, div_filter)
                    if divisions:
                        for div in divisions:
                            db["tournament_data"].replace_one(
                                {"trnid": trnid, "name": div["name"]},
                                {"trnid": trnid, **div},
                                upsert=True
                            )
                        print(f"  ✅ Synced {len(divisions)} division(s) for trnid={trnid}")
                    else:
                        print(f"  ⚠️ No data for trnid={trnid}")
                except Exception as e:
                    print(f"  ⚠️ Error syncing trnid={trnid}: {e}")
        except Exception as e:
            import traceback
            print(f"⚠️ Sync loop error: {e}")
            traceback.print_exc()

def startup_sync():
    """On startup, immediately sync all active tournaments."""
    time.sleep(5)
    active_list = list(db["active_tournaments"].find({}))
    if not active_list:
        return
    print(f"🔄 Startup sync for {len(active_list)} tournament(s)...")
    for active in active_list:
        trnid = active.get("trnid")
        if not trnid:
            continue
        try:
            if not scrape_tournament:
                print("⚠️ Scraper not available")
                return
            divisions = scrape_tournament(trnid, active.get("division"))
            for div in divisions:
                db["tournament_data"].replace_one(
                    {"trnid": trnid, "name": div["name"]},
                    {"trnid": trnid, **div},
                    upsert=True
                )
            print(f"  ✅ Synced trnid={trnid}")
        except Exception as e:
            print(f"  ⚠️ Startup sync error for trnid={trnid}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _sync_thread
    print("🥎 Softball API starting...")
    # Sync on startup if tournament is active
    threading.Thread(target=startup_sync, daemon=True).start()
    # Start background polling loop
    _sync_thread = threading.Thread(target=background_sync_loop, daemon=True)
    _sync_thread.start()
    yield
    print("🛑 Softball API shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/softball/tournaments")
def get_active_tournaments():
    """Returns list of all active tournaments."""
    active = list(db["active_tournaments"].find({}, {"_id": 0}))
    return {"tournaments": active}


@app.get("/api/softball/tournament")
def get_tournament(trnid: str = None):
    """Returns all divisions for a tournament. Uses first active if no trnid given."""
    if not trnid:
        first = db["active_tournaments"].find_one({}, {"_id": 0})
        if not first:
            return {"divisions": [], "status": "none", "trnid": None, "name": None}
        trnid = first.get("trnid")

    active = db["active_tournaments"].find_one({"trnid": trnid}, {"_id": 0})
    if not active:
        return {"divisions": [], "status": "none", "trnid": trnid, "name": None}

    docs = list(db["tournament_data"].find({"trnid": trnid}, {"_id": 0}))
    return {
        "divisions": docs,
        "trnid": trnid,
        "name": active.get("name", ""),
        "status": "active" if docs else "syncing"
    }


@app.post("/api/admin/softball/sync")
def admin_sync(
    payload: dict,
    username: str = Depends(verify_admin)
):
    """Trigger a scrape. Body: {trnid, name?, division?}
    If division is empty, scrapes ALL divisions for the tournament."""
    trnid = payload.get("trnid", "").strip()
    division = payload.get("division", "").strip() or None
    name = payload.get("name", "").strip()

    if not trnid:
        raise HTTPException(status_code=400, detail="trnid required")

    # Save as active tournament (supports multiple)
    db["active_tournaments"].replace_one(
        {"trnid": trnid},
        {"trnid": trnid, "division": division, "name": name},
        upsert=True
    )

    # Scrape in background
    def do_scrape():
        try:
            if not scrape_tournament:
                print("⚠️ Scraper not available")
                return
            divisions = scrape_tournament(trnid, division)
            for div in divisions:
                db["tournament_data"].replace_one(
                    {"trnid": trnid, "name": div["name"]},
                    {"trnid": trnid, **div},
                    upsert=True
                )
            print(f"✅ Scraped {len(divisions)} division(s) for trnid={trnid}")
        except Exception as e:
            print(f"⚠️ Scrape error: {e}")

    t = threading.Thread(target=do_scrape, daemon=True)
    t.start()

    return {"message": f"Sync started for trnid={trnid} ({'all divisions' if not division else division})"}


@app.post("/api/admin/softball/discover-tournaments")
def discover_tournaments(username: str = Depends(verify_admin)):
    """Scrape upcoming tournaments and save trnids to MongoDB."""
    def do_discover():
        try:
            from scraper import scrape_upcoming_tournaments
            tournaments = scrape_upcoming_tournaments()
            if tournaments:
                # Store each tournament, upsert by trnid
                for t in tournaments:
                    db["upcoming_tournaments"].replace_one(
                        {"trnid": t["trnid"]},
                        t,
                        upsert=True
                    )
                print(f"✅ Saved {len(tournaments)} upcoming tournaments")
        except Exception as e:
            import traceback
            print(f"⚠️ Discover error: {e}")
            traceback.print_exc()

    threading.Thread(target=do_discover, daemon=True).start()
    return {"message": "Discovery started — check back in ~30 seconds"}


@app.get("/api/softball/upcoming-tournaments")
def get_upcoming_tournaments():
    """Returns saved upcoming tournaments with trnids."""
    tournaments = list(db["upcoming_tournaments"].find({}, {"_id": 0})
                       .sort("date", 1))
    return {"tournaments": tournaments}


@app.delete("/api/admin/softball/tournament/{trnid}")
def remove_tournament(trnid: str, username: str = Depends(verify_admin)):
    """Remove a specific tournament from active list."""
    db["active_tournaments"].delete_one({"trnid": trnid})
    db["tournament_data"].delete_many({"trnid": trnid})
    return {"message": f"Removed trnid={trnid}"}


@app.delete("/api/admin/softball/clear")
def admin_clear(username: str = Depends(verify_admin)):
    """Clear all tournament data."""
    db["active_tournaments"].delete_many({})
    db["tournament_data"].delete_many({})
    return {"message": "Cleared"}


@app.get("/api/softball/health")
def health():
    return {"status": "ok"}