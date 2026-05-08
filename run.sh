#!/bin/bash
set -a
source /etc/environment
set +a

# Kill anything on these ports
fuser -k 80/tcp 2>/dev/null
fuser -k 8000/tcp 2>/dev/null
fuser -k 9000/tcp 2>/dev/null
fuser -k 3000/tcp 2>/dev/null

# Start personal site Node.js server
(cd /root/Full_Website/myWebsite/api && node server.js) &

# Start WGI scraper worker
(cd /root/Full_Website/New_WGI && /root/Full_Website/New_WGI/venv/bin/python backend/scraper_worker.py) &

# Start WGI FastAPI
(cd /root/Full_Website/New_WGI && /root/Full_Website/New_WGI/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000) &

# #Start Softball scraper
# (cd /root/Full_Website/Softball_App && /root/Full_Website/Softball_App/ backend/scraper.py) &

# Start Softball FastAPI
(
  cd /root/Full_Website/Softball_App || exit 1
  /root/Full_Website/Softball_App/backend/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 9000
) >> /root/startup.log 2>&1 &

# Give all services a moment to start
sleep 2

# Start nginx (blocking — must be last)
nginx -g "daemon off;"