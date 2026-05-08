#!/bin/bash
set -a
source /etc/environment
set +a

# Kill anything on these ports
fuser -k 80/tcp 2>/dev/null
fuser -k 8000/tcp 2>/dev/null
fuser -k 9000/tcp 2>/dev/null
fuser -k 3000/tcp 2>/dev/null

sleep 1

# Start personal site Node.js server
nohup bash -c 'cd /root/Full_Website/myWebsite/api && node server.js' >> /root/logs/node.log 2>&1 &

# Start WGI scraper worker
nohup bash -c 'cd /root/Full_Website/New_WGI && /root/Full_Website/New_WGI/venv/bin/python backend/scraper_worker.py' >> /root/logs/wgi_worker.log 2>&1 &

# Start WGI FastAPI
nohup bash -c 'cd /root/Full_Website/New_WGI && /root/Full_Website/New_WGI/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000' >> /root/logs/wgi_api.log 2>&1 &

# Start Softball FastAPI
nohup bash -c 'cd /root/Full_Website/Softball_App/backend && /root/Full_Website/Softball_App/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 9000' >> /root/logs/softball_api.log 2>&1 &

# Give all services a moment to start
sleep 3

# Start nginx (blocking — must be last)
nginx -g "daemon off;"