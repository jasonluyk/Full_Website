"""
seed_db.py — WGI Analytics Database Seeder
Runs on local machine or any server with Python + requests.
NO browser/Playwright needed — WGI scores page is plain HTML.
"""
import os
import re
import requests
import pymongo
from bs4 import BeautifulSoup
from datetime import datetime
from collections import defaultdict


SCORES_PAGE = "https://www.wgi.org/scores/color-guard-scores/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def clean_class_name(raw_class):
    clean = re.sub(r'(?i)\s*-\s*(Prelims|Finals|Round.*|Semi.*)', '', raw_class)
    clean = re.sub(r'(?i)\s*\((Prelims|Finals|Round.*|Semi.*)\)', '', clean)
    return clean.strip()


def get_mongo():
    mongo_url = os.environ.get("MONGO_URI")
    if not mongo_url:
        raise ValueError("MONGO_URI environment variable not set")
    client = pymongo.MongoClient(mongo_url)
    return client["rankings_2026"]


def scrape_scores_page():
    """
    Scrapes wgi.org/scores/color-guard-scores/ with plain requests.
    Returns list of {name, show_id, recap_url, date} dicts.
    """
    print("📡 Fetching WGI scores page...")
    resp = requests.get(SCORES_PAGE, headers=HEADERS, timeout=30)
    soup = BeautifulSoup(resp.text, 'html.parser')

    events = []
    current_date = None

    for table in soup.find_all('table'):
        # Date header
        th = table.find('th')
        if th:
            date_text = th.get_text(strip=True)
            # Parse date like "April 11" — add current year
            try:
                dt = datetime.strptime(f"{date_text} 2026", "%B %d %Y")
                current_date = dt.strftime("%Y-%m-%d")
            except Exception:
                current_date = None

        for row in table.find_all('tr'):
            name_td = row.find('td', class_='event-name')
            if not name_td:
                continue

            name = name_td.get_text(strip=True)
            show_id = ""
            recap_url = ""

            for a in row.find_all('a', href=True):
                href = a['href']
                if 'ShowId=' in href:
                    show_id = href.split("ShowId=")[-1].strip()
                elif 'competitionsuite.com' in href and 'recap' in href:
                    recap_url = href

            if name and show_id:
                events.append({
                    "name": name,
                    "show_id": show_id,
                    "recap_url": recap_url,
                    "date": current_date,
                    "is_finals": "finals" in name.lower(),
                    "is_prelims": "prelim" in name.lower(),
                    "is_plus": name.endswith("+"),
                })

    print(f"  Found {len(events)} events on scores page")
    return events


def scrape_event_scores(show_id, show_name):
    """
    Scrapes scores for a single event from WGI using plain requests.
    Returns list of {Guard, Class, Score, Show, Date} dicts.
    """
    url = f"https://www.wgi.org/scores/color-guard-score-event/?ShowId={show_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        soup = BeautifulSoup(resp.text, 'html.parser')
    except Exception as e:
        print(f"  ⚠️ Error fetching {show_name}: {e}")
        return []

    records = []
    current_class = "Unknown Class"

    for table in soup.find_all('table'):
        for row in table.find_all('tr'):
            # Class header
            th = row.find('th')
            if th:
                current_class = clean_class_name(th.get_text(strip=True))
                continue

            cols = row.find_all('td')
            if len(cols) >= 3:
                guard = cols[1].get_text(strip=True)
                score_text = cols[2].get_text(strip=True).upper().replace("VIEW RECAP", "").strip()
                try:
                    score = float(score_text)
                    if guard:
                        records.append({
                            "Guard": guard,
                            "Class": current_class,
                            "Score": score,
                            "Show": show_name,
                        })
                except ValueError:
                    continue

    return records


def seed_all():
    db = get_mongo()

    # Step 1: Get all events from scores page
    events = scrape_scores_page()

    # Step 2: Save event_metadata (for Past Events page)
    print("\n💾 Saving event metadata...")
    for evt in events:
        db["event_metadata"].update_one(
            {"show_id": evt["show_id"]},
            {"$set": {
                "name": evt["name"],
                "show_id": evt["show_id"],
                "recap_url": evt["recap_url"],
                "date": evt["date"],
                "is_finals": evt["is_finals"],
                "is_plus": evt["is_plus"],
                # Derive p_url and f_url from recap URLs for schedule use
                "p_url": evt["recap_url"] if evt["is_prelims"] else "",
                "f_url": evt["recap_url"] if evt["is_finals"] else "",
            }},
            upsert=True
        )
    print(f"  Saved {len(events)} events to event_metadata")

    # Step 3: Scrape scores for every event
    print("\n📊 Scraping all event scores...")
    all_records = []
    for i, evt in enumerate(events):
        print(f"  [{i+1}/{len(events)}] {evt['name']}...")
        records = scrape_event_scores(evt["show_id"], evt["name"])
        # Add date to each record
        for r in records:
            r["Date"] = evt["date"]
        all_records.extend(records)
        if records:
            print(f"    → {len(records)} scores")

    # Step 4: Save to wgi_analytics
    if all_records:
        print(f"\n💾 Saving {len(all_records)} score records to MongoDB...")
        db["wgi_analytics"].drop()
        db["wgi_analytics"].insert_many(all_records)
        print(f"✅ Done! {len(all_records)} performances saved.")
    else:
        print("❌ No score records found.")

    # Step 5: Update discovery status
    db["system_state"].update_one(
        {"type": "discovery_status"},
        {"$set": {
            "status": "complete",
            "count": len(events),
            "updated": datetime.utcnow().isoformat()
        }},
        upsert=True
    )


if __name__ == "__main__":
    seed_all()