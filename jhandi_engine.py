import os, time, hashlib, threading
from typing import List, Dict, Any, Optional

SYMBOLS = ['club', 'crown', 'spade', 'diamond', 'flag', 'heart']
ROUND_SECONDS = 30
BETTING_CLOSE_SECONDS = 5 # Last 5 seconds are locked
SERVER_SECRET = os.environ.get("JHANDI_SERVER_SECRET", "cricknova_jhandi_royal_secret_salt_2026_super_secure_8877_auth")

_lock = threading.Lock()
# round_id -> { mobile -> { bets: {sym: paise}, settled: bool, payout_paise: int } }
_round_bets: Dict[int, Dict[str, Any]] = {}

def get_current_round_info() -> Dict[str, Any]:
    now = time.time()
    round_id = int(now // ROUND_SECONDS)
    elapsed = now % ROUND_SECONDS
    seconds_left = max(0, int(ROUND_SECONDS - elapsed))
    betting_open = seconds_left > BETTING_CLOSE_SECONDS

    return {
        "round_id": round_id,
        "seconds_left": seconds_left,
        "elapsed": round(elapsed, 1),
        "total_seconds": ROUND_SECONDS,
        "blind_lock_seconds": BETTING_CLOSE_SECONDS,
        "betting_open": betting_open
    }

def get_round_outcome(round_id: int) -> List[str]:
    """
    Deterministically and cryptographically derives the 6 dice faces for round_id.
    Ensures every player in the world sees identical dice faces and server verifies settlement.
    """
    raw = f"{round_id}:{SERVER_SECRET}".encode()
    h = hashlib.sha256(raw).hexdigest()
    dice = []
    for i in range(6):
        hex_slice = h[i*4 : (i+1)*4]
        val = int(hex_slice, 16)
        dice.append(SYMBOLS[val % len(SYMBOLS)])
    return dice

def get_multiplier(count: int, single_match_pays: bool = False) -> float:
    if count == 1:
        return 2.0 if single_match_pays else 0.0
    elif count == 2:
        return 2.5
    elif count == 3:
        return 5.0
    elif count == 4:
        return 10.0
    elif count == 5:
        return 20.0
    elif count >= 6:
        return 100.0
    return 0.0

def register_jhandi_bet(round_id: int, mobile: str, bets_dict: Dict[str, int]):
    with _lock:
        if round_id not in _round_bets:
            _round_bets[round_id] = {}
        user_round = _round_bets[round_id].setdefault(mobile, {
            "bets": {},
            "settled": False,
            "payout_paise": 0
        })
        for sym, paise in bets_dict.items():
            if sym in SYMBOLS and paise > 0:
                user_round["bets"][sym] = user_round["bets"].get(sym, 0) + paise

def get_user_round_bets(round_id: int, mobile: str) -> Optional[Dict[str, Any]]:
    with _lock:
        return _round_bets.get(round_id, {}).get(mobile)

def mark_user_round_settled(round_id: int, mobile: str, payout_paise: int):
    with _lock:
        if round_id in _round_bets and mobile in _round_bets[round_id]:
            _round_bets[round_id][mobile]["settled"] = True
            _round_bets[round_id][mobile]["payout_paise"] = payout_paise
