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
    """Auto-resync every 5 minutes if a tournament is active."""
    while True:
        time.sleep(120)
        active = db["active_tournament"].find_one({"type": "current"})
        if active and active.get("trnid") and active.get("division"):
            try:
                from scraper import scrape_tournament
                divisions = scrape_tournament(active["trnid"], active["division"])
                if divisions:
                    db["tournament_data"].replace_one(
                        {"trnid": active["trnid"], "division": divisions[0]["name"]},
                        {"trnid": active["trnid"], **divisions[0]},
                        upsert=True
                    )
                    print(f"✅ Auto-synced {active['division']}")
            except Exception as e:
                print(f"⚠️ Auto-sync error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _sync_thread
    print("🥎 Softball API starting...")
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
            from scraper import scrape_tournament
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