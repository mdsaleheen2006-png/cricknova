import os, time, hmac, hashlib, secrets
from typing import Dict, Optional
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse

ADMIN_SECRET_KEY = os.environ.get("CRICKNOVA_ADMIN_SECRET", "cricknova_master_admin_jwt_secret_998877")
ADMIN_MASTER_PASSWORD = os.environ.get("CRICKNOVA_ADMIN_PASSWORD", "Cricknova@Admin2026")

# Memory store for active admin sessions: token -> {admin_id, created_at, expires_at}
_active_admin_sessions: Dict[str, dict] = {}
# Rate limiting for failed admin attempts: ip -> [timestamps]
_failed_attempts: Dict[str, list] = {}

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def check_login_rate_limit(request: Request):
    ip = get_client_ip(request)
    now = time.time()
    attempts = [t for t in _failed_attempts.get(ip, []) if now - t < 900] # 15 min window
    _failed_attempts[ip] = attempts
    if len(attempts) >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many failed admin login attempts. Please wait 15 minutes before retrying."
        )

def record_failed_attempt(request: Request):
    ip = get_client_ip(request)
    now = time.time()
    _failed_attempts.setdefault(ip, []).append(now)

def create_admin_session(admin_id: str = "master_admin") -> str:
    token = secrets.token_hex(32)
    now = time.time()
    _active_admin_sessions[token] = {
        "admin_id": admin_id,
        "created_at": now,
        "expires_at": now + (12 * 3600) # 12 hours
    }
    return token

def is_admin_authenticated(request: Request) -> bool:
    token = request.cookies.get("cricknova_admin_session") or request.headers.get("x-admin-token")
    if not token or token not in _active_admin_sessions:
        return False
    session = _active_admin_sessions[token]
    if time.time() > session.get("expires_at", 0):
        del _active_admin_sessions[token]
        return False
    return True

def require_admin_auth(request: Request):
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="Unauthorized: Master admin credentials required.")

def require_admin_page(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    return None
