# In Softball_App/backend, run python3 and paste:
from scraper import scrape_tournament
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("https://playtopgunsports.com/UpcomingTournaments.aspx")
    page.wait_for_timeout(5000)
    html = page.content()
    browser.close()

soup = BeautifulSoup(html, 'html.parser')
# Find all links with trnid
links = soup.find_all('a', href=lambda h: h and 'trnid=' in h)
for l in links:
    print(l.get_text(strip=True), '->', l['href'])