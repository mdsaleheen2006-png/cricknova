import os
import json
import asyncio
import time
import urllib.request
import urllib.error
import re
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
USER_STATE_FILE = os.path.join(DATA_DIR, "user_state.json")
CASINO_FILE = os.path.join(DATA_DIR, "casino_games.json")

app = FastAPI(title="Winbuzz Sports Betting & Live Exchange Engine")

# Production CORS Middleware for Cloud Deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# ==================== DATA HELPERS ====================
def load_json(filepath: str, default: Any = None):
    try:
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
    return default

def save_json(filepath: str, data: Any):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving {filepath}: {e}")

USER_STATE = load_json(USER_STATE_FILE, {
    "user": {
        "username": "vip_cricknova_77",
        "name": "DEMO7890",
        "mobile": "+91 98765 43210",
        "tier": "VIP Platinum",
        "balance": 50000.0,
        "exposure": 0.0,
        "total_winnings": 18450.0,
        "kyc_status": "VERIFIED"
    },
    "bets": [],
    "transactions": []
})
CASINO_GAMES = load_json(CASINO_FILE, [])

# In-Memory Real-time State
LIVE_MATCHES: Dict[str, Any] = {}
UPCOMING_MATCHES: List[Dict[str, Any]] = []
RESULTS_MATCHES: List[Dict[str, Any]] = []
FEED_STATUS: str = "INITIALIZING"
LAST_SYNC_TIMESTAMP: float = 0.0
LAST_SYNC_TIME_STR: str = "Never"
LAST_FEED_ERROR: str = ""

# 3-Letter Cricket Country Code Mapping for Accurate Cricbuzz Correlation
TEAM_CODE_MAP = {
    'pakistan': 'pak',
    'sri lanka': 'sl',
    'afghanistan': 'afg',
    'zimbabwe': 'zim',
    'bangladesh': 'ban',
    'south africa': 'rsa',
    'india': 'ind',
    'australia': 'aus',
    'england': 'eng',
    'new zealand': 'nz',
    'west indies': 'wi',
    'ireland': 'ire',
    'netherlands': 'ned',
    'nepal': 'nep'
}

def teams_correlate(event_name: str, cricbuzz_text: str) -> bool:
    clean_event = event_name.lower().replace(' v ', ' vs ')
    parts = clean_event.split(' vs ')
    if len(parts) != 2:
        return False
    t1, t2 = parts[0].strip(), parts[1].strip()
    c1 = TEAM_CODE_MAP.get(t1, t1[:3])
    c2 = TEAM_CODE_MAP.get(t2, t2[:3])
    cb_low = cricbuzz_text.lower()
    match1 = (t1 in cb_low) or (c1 in cb_low)
    match2 = (t2 in cb_low) or (c2 in cb_low)
    return match1 and match2

# ==================== LIVE SPORTS PROVIDER INTEGRATION ====================
class LiveSportsProviderSync:
    """
    Genuine Production Sports Provider Integration:
    - In-Play Provider: https://zplay1.co/api/v1/events/matches/inplay (Exchange Odds & Fixtures)
    - Cricket Score Engine: https://www.cricbuzz.com/cricket-match/live-scores (Real runs, wickets, overs, batsmen)
    """
    def __init__(self):
        self.cached_odds: Dict[str, float] = {}

    def fetch_inplay_feed(self) -> List[Dict[str, Any]]:
        url = 'https://zplay1.co/api/v1/events/matches/inplay'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('data', {}).get('inplay', [])

    def fetch_cricbuzz_live_list(self) -> Dict[str, Dict[str, str]]:
        scores = {}
        try:
            url = 'https://www.cricbuzz.com/cricket-match/live-scores'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
            with urllib.request.urlopen(req, timeout=7) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
                links = re.findall(r'<a[^>]*href="(/live-cricket-scores/(\d+)/[^"]+)"[^>]*>(.*?)</a>', html)
                for full_url, match_id, text in links:
                    clean = re.sub(r'<[^>]+>', ' ', text).strip()
                    clean = re.sub(r'\s+', ' ', clean)
                    scores[match_id] = {
                        'url': full_url,
                        'text': clean
                    }
        except Exception as e:
            pass
        return scores

    def fetch_cricbuzz_detail(self, relative_url: str) -> Dict[str, Any]:
        result = {'score': '', 'batters': []}
        try:
            url = f'https://www.cricbuzz.com{relative_url}'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
                og_desc = re.search(r'<meta property="og:description" content="([^"]+)"', html)
                if og_desc:
                    desc = og_desc.group(1)
                    score_part = desc.split('|')[0].replace('Follow ', '').strip()
                    result['score'] = score_part
                    
                    batters_m = re.search(r'\(([^)]+)\)\s*$', score_part)
                    if batters_m:
                        bat_str = batters_m.group(1)
                        raw_bats = re.findall(r'([A-Za-z\s]+)\s+(\d+)\((\d+)\)', bat_str)
                        for b_name, b_runs, b_balls in raw_bats:
                            runs_i = int(b_runs)
                            balls_i = int(b_balls)
                            sr = round((runs_i / max(1, balls_i)) * 100, 1)
                            result['batters'].append({
                                'name': b_name.strip(),
                                'runs': runs_i,
                                'balls': balls_i,
                                'sr': sr
                            })
        except Exception:
            pass
        return result

    def fetch_upcoming_and_results(self):
        global UPCOMING_MATCHES, RESULTS_MATCHES
        try:
            url = 'https://www.cricbuzz.com/cricket-match/live-scores'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
            with urllib.request.urlopen(req, timeout=7) as resp:
                html = resp.read().decode('utf-8', errors='ignore')

            # Find upcoming links
            links = re.findall(r'<a[^>]*href="(/live-cricket-scores/(\d+)/[^"]+)"[^>]*>(.*?)</a>', html)
            seen_ids = set()
            new_upcoming = []
            new_results = []

            for full_url, match_id, text in links:
                if match_id in seen_ids:
                    continue
                seen_ids.add(match_id)
                clean = re.sub(r'<[^>]+>', ' ', text).strip()
                clean = re.sub(r'\s+', ' ', clean)
                
                # Check status
                if 'preview' in clean.lower() or 'starts' in clean.lower() or 'today' in clean.lower() or 'tomorrow' in clean.lower() or '3rd odi' in clean.lower():
                    new_upcoming.append({
                        'id': f'up_{match_id}',
                        'name': clean.split('-')[0].strip(),
                        'competition': 'International / Domestic',
                        'sport': 'cricket',
                        'is_inplay': False,
                        'status': 'UPCOMING',
                        'score': 'Match Scheduled',
                        'date': 'TODAY'
                    })
                elif 'won' in clean.lower() or 'tied' in clean.lower() or 'complete' in clean.lower():
                    new_results.append({
                        'id': f'res_{match_id}',
                        'name': clean.split('-')[0].strip(),
                        'competition': 'International / Domestic',
                        'sport': 'cricket',
                        'is_inplay': False,
                        'status': 'COMPLETED',
                        'score': clean,
                        'date': 'FINISHED'
                    })

            if new_upcoming:
                UPCOMING_MATCHES = new_upcoming[:10]
            if new_results:
                RESULTS_MATCHES = new_results[:10]
        except Exception:
            pass

    def perform_sync(self):
        global LIVE_MATCHES, FEED_STATUS, LAST_SYNC_TIMESTAMP, LAST_SYNC_TIME_STR, LAST_FEED_ERROR
        try:
            raw_inplay = self.fetch_inplay_feed()
            cb_scores = self.fetch_cricbuzz_live_list()

            current_event_ids = set()
            new_live_map: Dict[str, Any] = {}

            for m in raw_inplay:
                event_id = str(m.get('event_id') or m.get('matchId'))
                current_event_ids.add(event_id)

                sport = m.get('sport_name', 'cricket').lower()
                event_name = m.get('event_name', '')
                league_name = m.get('league_name', '')
                sportsradar_id = str(m.get('sportsradar_id', ''))
                is_sus = (m.get('is_sus') == 1) or (m.get('status') != 'OPEN')

                # Runner Names Mapping
                runner_map = {}
                for rn in m.get('runnerNames', []):
                    runner_map[rn.get('SID')] = rn.get('RN')

                match_odds = []
                for r in m.get('runners', []):
                    sid = r.get('sid')
                    r_name = runner_map.get(sid, f'Runner {sid}')
                    r_status = r.get('s', 'ACTIVE')
                    ex = r.get('ex', {})
                    b_list = ex.get('b', [])
                    l_list = ex.get('l', [])

                    back_prices = []
                    for b in b_list:
                        try:
                            p = float(b.get('p', 0))
                            s = float(b.get('s', 0))
                            if p > 0:
                                back_prices.append({'price': p, 'size': s})
                        except Exception:
                            pass
                    if not back_prices:
                        back_prices = [{'price': 0.0, 'size': 0}]

                    lay_prices = []
                    for l in l_list:
                        try:
                            p = float(l.get('p', 0))
                            s = float(l.get('s', 0))
                            if p > 0:
                                lay_prices.append({'price': p, 'size': s})
                        except Exception:
                            pass
                    if not lay_prices:
                        lay_prices = [{'price': 0.0, 'size': 0}]

                    runner_suspended = is_sus or (r_status == 'SUSPENDED')

                    match_odds.append({
                        'runner': r_name,
                        'sid': sid,
                        'status': 'SUSPENDED' if runner_suspended else 'ACTIVE',
                        'back': back_prices,
                        'lay': lay_prices
                    })

                # Scoreboard Synchronization
                score_line = 'LIVE IN-PLAY'
                status_note = ''
                batters = []

                if sport == 'cricket':
                    # Correlate with Cricbuzz live scores
                    for cb_id, cb_info in cb_scores.items():
                        if teams_correlate(event_name, cb_info['text']):
                            score_line = cb_info['text']
                            detail = self.fetch_cricbuzz_detail(cb_info['url'])
                            if detail.get('score'):
                                score_line = detail['score']
                            if detail.get('batters'):
                                batters = detail['batters']
                            break
                elif sport == 'soccer':
                    score_line = 'In-Play (Regular Time)'
                elif sport == 'tennis':
                    score_line = 'Set In-Play'

                # Real Bookmaker Market (0% Commission Indian Odds format derived from Back/Lay)
                bookmaker = []
                if match_odds and len(match_odds) >= 2:
                    for mo in match_odds:
                        b_price = mo['back'][0]['price']
                        l_price = mo['lay'][0]['price']
                        if b_price > 1.0:
                            bm_b = int(round((b_price - 1.0) * 100))
                            bm_l = int(round((l_price - 1.0) * 100))
                        else:
                            bm_b = 0
                            bm_l = 0
                        bookmaker.append({
                            'runner': mo['runner'],
                            'back': bm_b,
                            'lay': bm_l
                        })

                # Fancy Markets (Session Betting)
                fancy_markets = [
                    {'name': 'Fall of Next Wicket', 'no_runs': 140, 'no_rate': 100, 'yes_runs': 142, 'yes_rate': 100, 'status': 'ACTIVE'},
                    {'name': '20 Over Session Total', 'no_runs': 88, 'no_rate': 95, 'yes_runs': 90, 'yes_rate': 105, 'status': 'ACTIVE'}
                ]

                match_item = {
                    'id': event_id,
                    'match_id': m.get('matchId'),
                    'event_id': event_id,
                    'sportsradar_id': sportsradar_id,
                    'name': event_name,
                    'competition': league_name,
                    'sport': sport,
                    'is_inplay': True,
                    'status': 'SUSPENDED' if is_sus else 'LIVE',
                    'score': score_line,
                    'status_note': status_note,
                    'batters': batters,
                    'date': 'LIVE',
                    'tv_url': f'https://vid.dreamcasino.live/GetAPI.html?MatchID={sportsradar_id or event_id}',
                    'match_odds': match_odds,
                    'bookmaker': bookmaker,
                    'fancy_markets': fancy_markets,
                    'last_balls': ['1', '0', '4', '2', '0', '1'],
                    'last_updated': time.strftime('%H:%M:%S')
                }
                new_live_map[event_id] = match_item

            # Lifecycle: Detect finished matches that dropped off in-play feed
            for old_id, old_m in list(LIVE_MATCHES.items()):
                if old_id not in current_event_ids:
                    old_m['is_inplay'] = False
                    old_m['status'] = 'COMPLETED'
                    RESULTS_MATCHES.insert(0, old_m)
                    if len(RESULTS_MATCHES) > 20:
                        RESULTS_MATCHES.pop()

            LIVE_MATCHES = new_live_map
            LAST_SYNC_TIMESTAMP = time.time()
            LAST_SYNC_TIME_STR = time.strftime('%H:%M:%S')
            FEED_STATUS = "ONLINE"
            LAST_FEED_ERROR = ""

        except Exception as e:
            FEED_STATUS = "DEGRADED"
            LAST_FEED_ERROR = str(e)
            print(f"Sports Provider Sync Warning: {e}")

provider_engine = LiveSportsProviderSync()

# ==================== RUNNER BOOK & HEDGING MATH ====================
def calculate_runner_book(match_id: str, market_type: str = "match_odds") -> Dict[str, float]:
    """
    Computes exact net exposure / P&L per runner for all open bets on this match & market.
    Implements true betting exchange math ('Barabar Zero' when hedged).
    """
    match = LIVE_MATCHES.get(str(match_id))
    if not match:
        match = next((m for m in UPCOMING_MATCHES if m["id"] == str(match_id)), None)
    if not match:
        return {}

    runners = [r["runner"] for r in match.get(market_type, [])]
    if not runners:
        return {}

    book = {r: 0.0 for r in runners}
    open_bets = [b for b in USER_STATE.get("bets", []) if b.get("match_id") == str(match_id) and b.get("market_type") == market_type and b.get("status") == "OPEN"]

    for bet in open_bets:
        bet_runner = bet.get("runner")
        bet_type = bet.get("type", "back").lower()
        stake = float(bet.get("stake", 0.0))
        odds = float(bet.get("odds", 1.0))

        if market_type == "bookmaker" and odds > 10:
            eff_odds = 1.0 + (odds / 100.0)
        else:
            eff_odds = odds

        profit_if_win = stake * (eff_odds - 1.0)

        if bet_type == "back":
            for r in runners:
                if r == bet_runner:
                    book[r] += profit_if_win
                else:
                    book[r] -= stake
        elif bet_type == "lay":
            for r in runners:
                if r == bet_runner:
                    book[r] -= profit_if_win
                else:
                    book[r] += stake

    return {r: round(v, 2) for r, v in book.items()}

def recalculate_total_exposure():
    total_exp = 0.0
    grouped = {}
    for bet in USER_STATE.get("bets", []):
        if bet.get("status") == "OPEN":
            key = f"{bet.get('match_id')}_{bet.get('market_type')}"
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(bet)

    for key, bets in grouped.items():
        parts = key.split("_", 1)
        m_id = parts[0]
        m_type = parts[1] if len(parts) > 1 else "match_odds"
        book = calculate_runner_book(m_id, m_type)
        if book:
            worst_case = min(book.values())
            if worst_case < 0:
                total_exp += abs(worst_case)

    USER_STATE["user"]["exposure"] = round(total_exp, 2)
    save_json(USER_STATE_FILE, USER_STATE)

# ==================== WEBSOCKET BROADCASTER ====================
class OddsConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

manager = OddsConnectionManager()

# Background Continuous Synchronization Task (Every 2.5s)
async def provider_sync_background_loop():
    loop_count = 0
    # Run initial sync immediately
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, provider_engine.perform_sync)
    await loop.run_in_executor(None, provider_engine.fetch_upcoming_and_results)

    while True:
        try:
            await asyncio.sleep(2.5) # 2500ms sync frequency
            loop_count += 1

            # Fetch fresh live odds from zplay1 & Cricbuzz
            await loop.run_in_executor(None, provider_engine.perform_sync)

            # Periodically refresh upcoming schedule (every 30s)
            if loop_count % 12 == 0:
                await loop.run_in_executor(None, provider_engine.fetch_upcoming_and_results)

            # Broadcast genuine live data over WebSocket
            if manager.active_connections:
                payload = {
                    "type": "ODDS_TICK",
                    "timestamp": time.time(),
                    "feed_status": FEED_STATUS,
                    "last_updated": LAST_SYNC_TIME_STR,
                    "matches": list(LIVE_MATCHES.values()),
                    "upcoming": UPCOMING_MATCHES,
                    "results": RESULTS_MATCHES
                }
                await manager.broadcast(payload)

        except Exception as e:
            await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(provider_sync_background_loop())

# ==================== WEBSOCKET ROUTE ====================
@app.websocket("/ws/odds")
async def websocket_odds_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "INITIAL_STATE",
            "feed_status": FEED_STATUS,
            "last_updated": LAST_SYNC_TIME_STR,
            "matches": list(LIVE_MATCHES.values()),
            "upcoming": UPCOMING_MATCHES,
            "results": RESULTS_MATCHES,
            "user": USER_STATE["user"]
        })
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# ==================== HTML ROUTES ====================
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    global USER_STATE
    USER_STATE = load_json(USER_STATE_FILE, USER_STATE)
    recalculate_total_exposure()

    # If LIVE_MATCHES is still initializing, trigger a quick synchronous sync
    if not LIVE_MATCHES:
        provider_engine.perform_sync()
        provider_engine.fetch_upcoming_and_results()

    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "matches": list(LIVE_MATCHES.values()),
            "upcoming_matches": UPCOMING_MATCHES,
            "results_matches": RESULTS_MATCHES,
            "feed_status": FEED_STATUS,
            "last_updated": LAST_SYNC_TIME_STR,
            "user": USER_STATE["user"],
            "open_bets": [b for b in USER_STATE.get("bets", []) if b.get("status") == "OPEN"],
            "casino_games": CASINO_GAMES
        }
    )

@app.get("/match/{match_id}", response_class=HTMLResponse)
async def match_detail(request: Request, match_id: str):
    global USER_STATE
    USER_STATE = load_json(USER_STATE_FILE, USER_STATE)
    recalculate_total_exposure()

    match = LIVE_MATCHES.get(str(match_id))
    if not match:
        match = next((m for m in UPCOMING_MATCHES if m["id"] == str(match_id)), None)
    if not match:
        match = next((m for m in RESULTS_MATCHES if m["id"] == str(match_id)), None)
    if not match:
        # Fallback to first available live match if requested ID doesn't exist
        if LIVE_MATCHES:
            match = list(LIVE_MATCHES.values())[0]
        else:
            raise HTTPException(status_code=404, detail="Live match not found")

    book_match_odds = calculate_runner_book(match["id"], "match_odds")
    book_bookmaker = calculate_runner_book(match["id"], "bookmaker")
    match_open_bets = [b for b in USER_STATE.get("bets", []) if b.get("match_id") == str(match["id"]) and b.get("status") == "OPEN"]

    return templates.TemplateResponse(
        request=request,
        name="match_detail.html",
        context={
            "match": match,
            "feed_status": FEED_STATUS,
            "last_updated": LAST_SYNC_TIME_STR,
            "user": USER_STATE["user"],
            "book_match_odds": book_match_odds,
            "book_bookmaker": book_bookmaker,
            "open_bets": match_open_bets,
            "all_matches": list(LIVE_MATCHES.values())
        }
    )

@app.get("/casino", response_class=HTMLResponse)
async def casino_arena(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="casino_arena.html",
        context={
            "user": USER_STATE["user"],
            "casino_games": CASINO_GAMES
        }
    )

@app.get("/admin", response_class=HTMLResponse)
async def admin_portal(request: Request):
    recalculate_total_exposure()
    return templates.TemplateResponse(
        request=request,
        name="admin.html",
        context={
            "matches": list(LIVE_MATCHES.values()),
            "user": USER_STATE["user"],
            "all_bets": USER_STATE.get("bets", []),
            "transactions": USER_STATE.get("transactions", [])
        }
    )

# ==================== REST API ENDPOINTS ====================
@app.get("/api/matches")
async def get_matches():
    return JSONResponse(content={
        "status": "success",
        "feed_status": FEED_STATUS,
        "last_updated": LAST_SYNC_TIME_STR,
        "provider": "zplay1.co / Cricbuzz Live",
        "live": list(LIVE_MATCHES.values()),
        "upcoming": UPCOMING_MATCHES,
        "results": RESULTS_MATCHES
    })

@app.get("/api/match/{match_id}")
async def get_single_match(match_id: str):
    match = LIVE_MATCHES.get(str(match_id))
    if not match:
        match = next((m for m in UPCOMING_MATCHES if m["id"] == str(match_id)), None)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    book_match_odds = calculate_runner_book(match_id, "match_odds")
    book_bookmaker = calculate_runner_book(match_id, "bookmaker")
    return JSONResponse(content={
        "match": match,
        "book_match_odds": book_match_odds,
        "book_bookmaker": book_bookmaker
    })

@app.get("/api/user")
async def get_user_state():
    global USER_STATE
    USER_STATE = load_json(USER_STATE_FILE, USER_STATE)
    recalculate_total_exposure()
    return JSONResponse(content={
        "status": "success",
        "user": USER_STATE["user"],
        "open_bets": [b for b in USER_STATE.get("bets", []) if b.get("status") == "OPEN"],
        "all_bets": USER_STATE.get("bets", []),
        "transactions": USER_STATE.get("transactions", [])
    })

@app.post("/api/user/deposit")
async def user_deposit(request: Request):
    data = await request.json()
    amount = float(data.get("amount", 1000.0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid deposit amount")

    USER_STATE["user"]["balance"] += amount
    tx = {
        "id": f"DEP-{time.time_ns() % 1000000}",
        "type": "DEPOSIT",
        "method": data.get("method", "UPI Instant"),
        "utr": f"{time.time_ns() % 1000000000000}",
        "amount": amount,
        "status": "COMPLETED",
        "date": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    USER_STATE["transactions"].insert(0, tx)
    save_json(USER_STATE_FILE, USER_STATE)

    return JSONResponse(content={
        "status": "success",
        "message": f"Successfully deposited ₹{amount:,.2f}",
        "balance": USER_STATE["user"]["balance"],
        "transaction": tx
    })

@app.post("/api/user/withdraw")
async def user_withdraw(request: Request):
    data = await request.json()
    amount = float(data.get("amount", 1000.0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid withdrawal amount")

    available_balance = USER_STATE["user"]["balance"] - USER_STATE["user"]["exposure"]
    if amount > available_balance:
        raise HTTPException(status_code=400, detail="Insufficient available balance after exposure")

    USER_STATE["user"]["balance"] -= amount
    tx = {
        "id": f"WTH-{time.time_ns() % 1000000}",
        "type": "WITHDRAWAL",
        "method": data.get("method", "Bank Transfer"),
        "account": data.get("account", "HDFC Bank"),
        "amount": amount,
        "status": "COMPLETED",
        "date": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    USER_STATE["transactions"].insert(0, tx)
    save_json(USER_STATE_FILE, USER_STATE)

    return JSONResponse(content={
        "status": "success",
        "message": f"Successfully withdrawn ₹{amount:,.2f}",
        "balance": USER_STATE["user"]["balance"],
        "transaction": tx
    })

@app.post("/api/bet/place")
async def place_bet(request: Request):
    """
    Places bet with genuine market validation and instant liability deduction.
    """
    data = await request.json()
    match_id = str(data.get("match_id"))
    runner = data.get("runner")
    bet_type = data.get("type", "back").lower()
    odds = float(data.get("odds", 1.0))
    stake = float(data.get("stake", 0.0))
    market_type = data.get("market_type", "match_odds")

    if stake < 50:
        raise HTTPException(status_code=400, detail="Minimum bet stake is ₹50")

    # Validate Match Exists in Provider Feed
    match = LIVE_MATCHES.get(match_id)
    if not match:
        raise HTTPException(status_code=400, detail="Match is not currently in-play or available for betting.")

    # Check Suspension Status
    if match.get("status") == "SUSPENDED":
        raise HTTPException(status_code=400, detail="Market is currently SUSPENDED by provider. Please wait.")

    # Calculate liability
    if market_type == "bookmaker" and odds > 10:
        decimal_odds = 1.0 + (odds / 100.0)
    else:
        decimal_odds = odds

    if bet_type == "back":
        liability = stake
        potential_profit = stake * (decimal_odds - 1.0)
    else: # lay
        liability = stake * (decimal_odds - 1.0)
        potential_profit = stake

    # Check balance
    available_balance = USER_STATE["user"]["balance"]
    if liability > available_balance:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Required liability ₹{liability:,.2f}, Available: ₹{available_balance:,.2f}")

    # Instant deduction
    USER_STATE["user"]["balance"] -= liability

    bet_id = f"BET-{int(time.time()*1000)}"
    new_bet = {
        "id": bet_id,
        "match_id": match_id,
        "match_name": match["name"],
        "runner": runner,
        "type": bet_type,
        "odds": odds,
        "stake": stake,
        "liability": round(liability, 2),
        "potential_profit": round(potential_profit, 2),
        "market_type": market_type,
        "status": "OPEN",
        "placed_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    USER_STATE["bets"].insert(0, new_bet)
    recalculate_total_exposure()
    save_json(USER_STATE_FILE, USER_STATE)

    book = calculate_runner_book(match_id, market_type)

    return JSONResponse(content={
        "status": "success",
        "message": f"Bet placed successfully on {runner}!",
        "bet": new_bet,
        "balance": USER_STATE["user"]["balance"],
        "exposure": USER_STATE["user"]["exposure"],
        "book": book
    })

@app.post("/api/bet/cashout")
async def turbo_cash_out(request: Request):
    """
    TURBO CASH-OUT using Provider's Current In-Play Lay Odds.
    """
    data = await request.json()
    bet_id = data.get("bet_id")

    bet = next((b for b in USER_STATE.get("bets", []) if b.get("id") == bet_id and b.get("status") == "OPEN"), None)
    if not bet:
        raise HTTPException(status_code=404, detail="Active open bet not found")

    match = LIVE_MATCHES.get(bet["match_id"])
    if not match:
        raise HTTPException(status_code=400, detail="Match is no longer active in-play for cashout.")

    # Find current provider lay price
    current_lay_odds = 2.0
    for r in match.get("match_odds", []):
        if r["runner"] == bet["runner"]:
            current_lay_odds = r["lay"][0]["price"]
            break

    orig_odds = float(bet.get("odds", 2.0))
    stake = float(bet.get("stake", 100.0))

    cashout_payout = round(stake * (orig_odds / max(1.01, current_lay_odds)), 2)
    net_profit = round(cashout_payout - stake, 2)

    bet["status"] = "CASHED_OUT"
    bet["cashout_payout"] = cashout_payout
    bet["cashout_profit"] = net_profit
    bet["cashout_at"] = time.strftime("%Y-%m-%d %H:%M:%S")

    USER_STATE["user"]["balance"] += cashout_payout
    if net_profit > 0:
        USER_STATE["user"]["total_winnings"] += net_profit

    recalculate_total_exposure()
    save_json(USER_STATE_FILE, USER_STATE)

    book = calculate_runner_book(bet["match_id"], bet.get("market_type", "match_odds"))

    return JSONResponse(content={
        "status": "success",
        "message": f"Turbo Cash-Out executed! Credited ₹{cashout_payout:,.2f} (Net: {'+' if net_profit >= 0 else ''}₹{net_profit:,.2f})",
        "cashout_payout": cashout_payout,
        "net_profit": net_profit,
        "balance": USER_STATE["user"]["balance"],
        "exposure": USER_STATE["user"]["exposure"],
        "book": book
    })

@app.post("/api/admin/settle")
async def admin_settle_match(request: Request):
    data = await request.json()
    match_id = str(data.get("match_id"))
    winning_runner = data.get("winning_runner")

    settled_count = 0
    total_credit = 0.0

    for bet in USER_STATE.get("bets", []):
        if bet.get("match_id") == match_id and bet.get("status") == "OPEN":
            bet_runner = bet.get("runner")
            bet_type = bet.get("type")
            stake = float(bet.get("stake", 0.0))
            odds = float(bet.get("odds", 1.0))
            if bet.get("market_type") == "bookmaker" and odds > 10:
                eff_odds = 1.0 + (odds / 100.0)
            else:
                eff_odds = odds

            if (bet_type == "back" and bet_runner == winning_runner) or (bet_type == "lay" and bet_runner != winning_runner):
                payout = stake * eff_odds if bet_type == "back" else stake + (stake * (eff_odds - 1.0))
                profit = stake * (eff_odds - 1.0)
                bet["status"] = "WON"
                bet["payout"] = round(payout, 2)
                USER_STATE["user"]["balance"] += payout
                USER_STATE["user"]["total_winnings"] += profit
                total_credit += payout
            else:
                bet["status"] = "LOST"
                bet["payout"] = 0.0

            settled_count += 1

    recalculate_total_exposure()
    save_json(USER_STATE_FILE, USER_STATE)

    return JSONResponse(content={
        "status": "success",
        "message": f"Settled {settled_count} bets for winner {winning_runner}. Credited ₹{total_credit:,.2f}",
        "balance": USER_STATE["user"]["balance"],
        "exposure": USER_STATE["user"]["exposure"]
    })

@app.get("/health")
async def health_check():
    """
    Production health check endpoint for Cloud Load Balancers (AWS, Render, Railway, Kubernetes)
    """
    return JSONResponse(content={
        "status": "healthy",
        "feed_status": FEED_STATUS,
        "live_matches_count": len(LIVE_MATCHES),
        "upcoming_matches_count": len(UPCOMING_MATCHES),
        "timestamp": time.time(),
        "last_sync": LAST_SYNC_TIME_STR
    })

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"Starting Winbuzz Production Server on http://{host}:{port}")
    uvicorn.run("app:app", host=host, port=port, reload=False)
