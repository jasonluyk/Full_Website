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
    """Auto-resync every 2 minutes if a tournament is active."""
    while True:
        time.sleep(120)
        try:
            active = db["active_tournament"].find_one({"type": "current"})
            if not active or not active.get("trnid"):
                continue
            if not scrape_tournament:
                print("⚠️ Scraper not available")
                continue
            print(f"🔄 Background sync: {active.get('division', 'all')}...")
            divisions = scrape_tournament(active["trnid"], active.get("division"))
            if divisions:
                for div in divisions:
                    db["tournament_data"].replace_one(
                        {"trnid": active["trnid"], "name": div["name"]},
                        {"trnid": active["trnid"], **div},
                        upsert=True
                    )
                print(f"✅ Auto-synced {len(divisions)} division(s)")
            else:
                print(f"⚠️ Auto-sync returned no data for trnid={active['trnid']}")
        except Exception as e:
            import traceback
            print(f"⚠️ Auto-sync error: {e}")
            traceback.print_exc()

def startup_sync():
    """On startup, immediately sync if there's an active tournament."""
    time.sleep(5)  # Wait for DB connection to settle
    active = db["active_tournament"].find_one({"type": "current"})
    if active and active.get("trnid") and active.get("division"):
        print(f"🔄 Auto-syncing on startup: {active['division']}...")
        try:
            if not scrape_tournament:
                print("⚠️ Scraper not available for startup sync")
                return
            divisions = scrape_tournament(active["trnid"], active["division"])
            for div in divisions:
                db["tournament_data"].replace_one(
                    {"trnid": active["trnid"], "name": div["name"]},
                    {"trnid": active["trnid"], **div},
                    upsert=True
                )
            print(f"✅ Startup sync complete")
        except Exception as e:
            print(f"⚠️ Startup sync error: {e}")


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

@app.get("/api/softball/tournament")
def get_tournament():
    """Returns current tournament data."""
    active = db["active_tournament"].find_one({"type": "current"}, {"_id": 0})
    if not active:
        return {"data": None, "status": "none"}

    trnid = active.get("trnid")
    division = active.get("division")
    doc = db["tournament_data"].find_one(
        {"trnid": trnid, "name": division}, {"_id": 0}
    )
    return {
        "data": doc,
        "trnid": trnid,
        "division": division,
        "status": "active" if doc else "syncing"
    }


@app.post("/api/admin/softball/sync")
def admin_sync(
    payload: dict,
    username: str = Depends(verify_admin)
):
    """Trigger a scrape. Body: {trnid, division}"""
    trnid = payload.get("trnid", "").strip()
    division = payload.get("division", "").strip()

    if not trnid:
        raise HTTPException(status_code=400, detail="trnid required")

    # Save as active tournament
    db["active_tournament"].replace_one(
        {"type": "current"},
        {"type": "current", "trnid": trnid, "division": division or None},
        upsert=True
    )

    # Scrape in background
    def do_scrape():
        try:
            if not scrape_tournament:
                print("⚠️ Scraper not available")
                return
            divisions = scrape_tournament(trnid, division or None)
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

    return {"message": f"Sync started for trnid={trnid}"}


@app.delete("/api/admin/softball/clear")
def admin_clear(username: str = Depends(verify_admin)):
    """Clear all tournament data."""
    db["active_tournament"].delete_many({})
    db["tournament_data"].delete_many({})
    return {"message": "Cleared"}


@app.get("/api/softball/health")
def health():
    return {"status": "ok"}