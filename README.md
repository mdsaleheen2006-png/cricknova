# 🚀 WINBUZZ PRODUCTION BETTING EXCHANGE & CASINO ENGINE

A production-ready, zero-latency sports betting exchange, live cricket/football sportsbook, and live casino platform built with **FastAPI**, **WebSockets**, and real-time feeds from **zplay1.co** and **Cricbuzz**.

---

## 🏗️ Architecture & Features

* **Real In-Play Provider**: Direct feed from `zplay1.co/api/v1/events/matches/inplay` providing genuine Back & Lay odds across Cricket, Soccer, and Tennis.
* **Live Score Synchronization**: Real-time runs, overs, wickets, and on-pitch batsmen synced with Cricbuzz.
* **Dynamic Match Lifecycle**: Matches automatically appear under **Live In-Play** when started, and move to **Results** when finished.
* **Sub-second WebSocket Streaming**: Ultra-fast odds ticks streaming over `/ws/odds` with visual flashing (green drift up / red shorten).
* **True Exchange Math (Barabar Zero)**: Runner Book Hedging preview and automatic liability locking.
* **⚡ Turbo Cash-Out**: 1-click hedging using live market lay odds.
* **Casino Suite**: HTML5 Canvas Aviator, Live Teen Patti 20-20, Super Andar Bahar, and European Roulette.
* **Admin Portal**: Instant match settlement & global audit ledger at `/admin`.

---

## 💻 Local Run (Windows & Mac/Linux)

### Windows
Double-click `run.bat` or run in terminal:
```powershell
pip install -r requirements.txt
python app.py
```
Open [http://localhost:8000](http://localhost:8000)

### Linux / Mac
```bash
chmod +x run.sh
./run.sh
```

---

## ☁️ Cloud Hosting Guide (Production Ready)

### Option 1: 1-Click Hosting on Render.com (Recommended - Free / Easy)
1. Push this project folder to your **GitHub** account:
   ```bash
   git init
   git add .
   git commit -m "Winbuzz Production Release"
   git branch -M main
   git remote add origin https://github.com/your-username/winbuzz-exchange.git
   git push -u origin main
   ```
2. Go to [Render.com](https://render.com) and click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Render automatically detects the `Procfile`:
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Click **Create Web Service**. Your website is now live worldwide with free SSL (`https://your-app.onrender.com`)!

---

### Option 2: 1-Click Hosting on Railway.app
1. Go to [Railway.app](https://railway.app).
2. Click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Select this repository. Railway automatically reads `Procfile` and `PORT` and deploys in 60 seconds!

---

### Option 3: VPS / Cloud Server (Ubuntu / Debian / AWS EC2 / DigitalOcean)

#### With Docker Compose:
```bash
docker-compose up -d --build
```

#### With Systemd Service (Native Linux):
1. Copy project to `/var/www/winbuzz`.
2. Create `/etc/systemd/system/winbuzz.service`:
```ini
[Unit]
Description=Winbuzz Betting Exchange Production Service
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/winbuzz
ExecStart=/usr/local/bin/python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
3. Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable winbuzz
sudo systemctl start winbuzz
```

---

## 🔍 Health Check & Monitoring
* **Health Endpoint**: `GET /health` (returns JSON status for AWS/Cloud load balancers)
* **Matches Feed API**: `GET /api/matches` (live, upcoming, results)
* **User Wallet State**: `GET /api/user`
* **Admin Settlement**: `GET /admin`
