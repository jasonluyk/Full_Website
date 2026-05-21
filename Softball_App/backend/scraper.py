"""
Softball scraper — Top Gun Sports
NOTE: Must run from a residential IP (local machine, not droplet).
The Top Gun server blocks datacenter IPs.
"""
import re
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
BASE_URL = "https://playtopgunsports.com/GameTimesResults.aspx?trnid={}"


def to_float(val):
    try: return float(str(val).strip())
    except: return 0.0

def to_int(val):
    try: return int(float(str(val).strip()))
    except: return 0


def scrape_tournament(trnid: str, division_filter: str = None):
    url = BASE_URL.format(trnid)
    print(f"🥎 Scraping tournament {trnid}: {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=[
            "--no-sandbox", "--disable-blink-features=AutomationControlled"
        ])
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1920, "height": 1080}
        )
        page = context.new_page()
        page.goto(url, timeout=60000)
        page.wait_for_timeout(6000)
        html = page.content()
        browser.close()

    if len(html) < 500:
        print(f"❌ Got blocked (HTML={len(html)} bytes) — must run from local machine")
        return []

    soup = BeautifulSoup(html, 'html.parser')
    return parse_all_divisions(soup, division_filter)


def parse_all_divisions(soup, division_filter=None):
    """
    Find all division header tds (font-size:18pt) and parse each division.
    """
    divisions = []

    # Find all division headers
    division_headers = soup.find_all('td', style=lambda s: s and 'font-size:18pt' in s)
    print(f"  Found {len(division_headers)} division headers")

    for header_td in division_headers:
        name = header_td.get_text(strip=True)
        if not name or ':' not in name:
            continue

        # Filter if requested
        if division_filter and division_filter.lower() not in name.lower():
            continue

        print(f"  📂 Parsing: {name}")
        division = parse_division(header_td, name)
        divisions.append(division)

    print(f"  Total divisions parsed: {len(divisions)}")
    return divisions


def parse_division(header_td, name):
    """Parse a single division starting from its header td."""
    division = {
        "name": name,
        "standings": [],
        "pool_play": [],
        "brackets": []
    }

    # Walk sibling rows from the header
    parent_row = header_td.find_parent('tr')
    if not parent_row:
        return division

    current_section = None
    current_bracket_name = None
    row = parent_row.find_next_sibling('tr')

    while row:
        # Stop at next division header
        next_div = row.find('td', style=lambda s: s and 'font-size:18pt' in s)
        if next_div and next_div.get_text(strip=True) != name:
            break

        row_text = row.get_text(strip=True)

        # Detect section labels
        if row_text == 'Pool Play':
            current_section = 'pool_play'
            row = row.find_next_sibling('tr')
            continue

        if 'Bracket' in row_text and len(row_text) < 40 and 'View' not in row_text:
            current_section = 'bracket'
            current_bracket_name = row_text.strip()
            row = row.find_next_sibling('tr')
            continue

        # Find inner goldenrod tables (or any data table)
        inner_table = row.find('table')
        if inner_table:
            table_rows = inner_table.find_all('tr')
            if not table_rows:
                row = row.find_next_sibling('tr')
                continue

            # Identify table type from header row
            header_cells = [td.get_text(strip=True) for td in table_rows[0].find_all('td')]
            header_text = ' '.join(header_cells)

            is_standings = 'Won' in header_text and 'Lost' in header_text and 'Team Name' in header_text
            is_games = ('Team A' in header_text or 'Game #' in header_text) and 'Time' in header_text

            if is_standings and current_section is None:
                # Parse standings
                for data_row in table_rows[1:]:
                    cols = data_row.find_all('td')
                    if len(cols) >= 7:
                        team_num = cols[0].get_text(strip=True)
                        team_name = cols[1].get_text(strip=True)
                        location = cols[2].get_text(strip=True)
                        won = cols[3].get_text(strip=True)
                        lost = cols[4].get_text(strip=True)
                        runs_allowed = cols[5].get_text(strip=True)
                        runs_scored = cols[6].get_text(strip=True)

                        if team_name and team_name not in ('Team Name', ''):
                            division["standings"].append({
                                "seed": team_num,
                                "team": team_name,
                                "location": location,
                                "won": to_float(won),
                                "lost": to_float(lost),
                                "runs_allowed": to_int(runs_allowed),
                                "runs_scored": to_int(runs_scored),
                            })

            elif is_games:
                # Parse games
                games = []
                for data_row in table_rows[1:]:
                    cols = data_row.find_all('td')
                    if len(cols) >= 8:
                        game_num = cols[0].get_text(strip=True)
                        day = cols[1].get_text(strip=True)
                        time = cols[2].get_text(strip=True)
                        field = cols[3].get_text(strip=True)
                        team_a = cols[4].get_text(strip=True)
                        score_a = cols[5].get_text(strip=True).replace('\xa0', '').strip()
                        team_b = cols[6].get_text(strip=True)
                        score_b = cols[7].get_text(strip=True).replace('\xa0', '').strip()

                        if team_a or team_b:
                            games.append({
                                "game": game_num,
                                "day": day,
                                "time": time,
                                "field": field,
                                "team_a": team_a,
                                "score_a": score_a if score_a else None,
                                "team_b": team_b,
                                "score_b": score_b if score_b else None,
                                "complete": bool(score_a and score_b and
                                                 score_a.replace('.','').isdigit() and
                                                 score_b.replace('.','').isdigit()),
                            })

                if current_section == 'pool_play':
                    division["pool_play"] = games
                elif current_section == 'bracket':
                    division["brackets"].append({
                        "name": current_bracket_name or "Bracket",
                        "games": games
                    })

        row = row.find_next_sibling('tr')

    print(f"    → {len(division['standings'])} teams, "
          f"{len(division['pool_play'])} pool games, "
          f"{len(division['brackets'])} brackets")
    return division


def scrape_upcoming_tournaments():
    """
    Scrapes the Top Gun upcoming tournaments page, finds all tournaments
    with schedules posted, clicks each Schedule button to intercept the
    trnid from the redirect URL.
    Must run from a residential IP (local machine, not droplet).
    """
    print("🔍 Scraping upcoming tournaments...")
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=[
            "--no-sandbox", "--disable-blink-features=AutomationControlled"
        ])
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1920, "height": 1080}
        )

        # ── Step 1: Load upcoming tournaments page ────────────────────
        page = context.new_page()
        page.goto("https://playtopgunsports.com/UpcomingTournaments.aspx", timeout=60000)
        page.wait_for_timeout(4000)

        html = page.content()
        if len(html) < 500:
            print("❌ Blocked — must run from local machine")
            browser.close()
            return []

        soup = BeautifulSoup(html, 'html.parser')
        rows = soup.select('#ctl00_siteContentPlaceHolder_softballGridView tr:not(:first-child)')
        print(f"  Found {len(rows)} tournament rows")

        # ── Step 2: Find rows with Schedule buttons ───────────────────
        schedule_rows = []
        for row in rows:
            cells = row.find_all('td')
            if len(cells) < 5:
                continue
            btn = cells[4].find('input', attrs={'type': 'button'})
            if not btn:
                continue
            btn_value = btn.get('value', '')
            if 'schedule' not in btn_value.lower():
                continue
            onclick = btn.get('onclick', '')
            arg_match = re.search(r"'myGameTimeScores\$(\d+)'", onclick)
            if not arg_match:
                continue
            schedule_rows.append({
                'date': cells[0].get_text(strip=True),
                'name': cells[1].get_text(strip=True),
                'location': cells[2].get_text(strip=True),
                'director': cells[3].get_text(strip=True),
                'row_index': int(arg_match.group(1)),
                'onclick': onclick,
            })

        print(f"  Found {len(schedule_rows)} tournaments with schedules posted")

        # ── Step 3: Click each Schedule button, capture trnid ─────────
        for t in schedule_rows:
            try:
                print(f"  Checking: {t['name'][:50]}...")

                # Navigate fresh to the page each time
                page2 = context.new_page()

                # Listen for navigation to GameTimesResults
                trnid_found = None

                def handle_response(response):
                    nonlocal trnid_found
                    url = response.url
                    if 'GameTimesResults.aspx' in url and 'trnid=' in url:
                        match = re.search(r'trnid=(\d+)', url)
                        if match:
                            trnid_found = match.group(1)

                page2.on('response', handle_response)
                page2.goto("https://playtopgunsports.com/UpcomingTournaments.aspx", timeout=30000)
                page2.wait_for_timeout(3000)

                # Trigger the postback by evaluating the onclick
                page2.evaluate(f"javascript:__doPostBack('ctl00$siteContentPlaceHolder$softballGridView','myGameTimeScores${t['row_index']}')")
                page2.wait_for_timeout(4000)

                # Also check current URL
                current_url = page2.url
                if 'trnid=' in current_url:
                    match = re.search(r'trnid=(\d+)', current_url)
                    if match:
                        trnid_found = match.group(1)

                page2.close()

                if trnid_found:
                    print(f"    ✅ trnid={trnid_found}")
                    results.append({
                        'trnid': trnid_found,
                        'name': t['name'],
                        'date': t['date'],
                        'location': t['location'],
                        'director': t['director'],
                    })
                else:
                    print(f"    ⚠️ Could not extract trnid")

            except Exception as e:
                print(f"    ⚠️ Error: {e}")

        browser.close()

    print(f"✅ Found {len(results)} tournaments with trnids")
    return results