import os, json, time, asyncio, threading, re, uuid
from typing import Dict, Any, Optional, Tuple, List
from fastapi import HTTPException

# Thread-safe and async-safe locking for wallet operations
_wallet_locks: Dict[str, asyncio.Lock] = {}
_global_lock = threading.Lock()

def get_user_lock(mobile: str) -> asyncio.Lock:
    with _global_lock:
        if mobile not in _wallet_locks:
            _wallet_locks[mobile] = asyncio.Lock()
        return _wallet_locks[mobile]

def to_paise(amount: float) -> int:
    return int(round(float(amount) * 100))

def from_paise(paise: int) -> float:
    return round(float(paise) / 100.0, 2)


class UnifiedWalletService:
    """
    Central authoritative wallet service for CrickNova.
    Enforces:
    1. Integer-paise arithmetic across all transactions.
    2. Atomic operations protected by user-level async locks.
    3. Immutable ledger recording for every financial action.
    4. Strict available balance checking: Available = Balance - Exposure - Reserved Withdrawals.
    5. Prevention of double spending, negative balances, and duplicate credits.
    """

    @staticmethod
    def get_wallet_state(all_data: Dict[str, Any], mobile: str) -> Dict[str, Any]:
        users = all_data.setdefault("users", {})
        user = users.get(mobile)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Ensure all integer-paise fields exist and are normalized
        if "balance_paise" not in user:
            user["balance_paise"] = to_paise(user.get("balance", 0.0))
        if "exposure_paise" not in user:
            user["exposure_paise"] = to_paise(user.get("exposure", 0.0))
        if "reserved_withdrawal_paise" not in user:
            user["reserved_withdrawal_paise"] = 0

        # Keep float mirrors synchronized for backward-compatible templates
        user["balance"] = from_paise(user["balance_paise"])
        user["exposure"] = from_paise(user["exposure_paise"])

        bal_paise = user["balance_paise"]
        exp_paise = user["exposure_paise"]
        res_paise = user["reserved_withdrawal_paise"]
        avail_paise = max(0, bal_paise - exp_paise - res_paise)

        return {
            "mobile": mobile,
            "name": user.get("name", f"Player {mobile[-4:]}"),
            "balance_paise": bal_paise,
            "balance": from_paise(bal_paise),
            "exposure_paise": exp_paise,
            "exposure": from_paise(exp_paise),
            "reserved_withdrawal_paise": res_paise,
            "reserved_withdrawal": from_paise(res_paise),
            "available_paise": avail_paise,
            "available": from_paise(avail_paise)
        }

    @staticmethod
    async def debit(
        all_data: Dict[str, Any],
        mobile: str,
        amount_paise: int,
        tx_type: str,
        ref_id: str,
        game_or_market: str = "Casino/Market",
        description: str = "Bet liability debit",
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Atomically debits the user's available balance.
        Prevents negative balance and double-spending.
        """
        if amount_paise <= 0:
            raise HTTPException(status_code=400, detail="Debit amount must be greater than zero")

        lock = get_user_lock(mobile)
        async with lock:
            user = all_data.get("users", {}).get(mobile)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            # Check idempotency
            idem = idempotency_key or f"{tx_type}-{ref_id}"
            ledger = all_data.setdefault("ledger", [])
            for entry in ledger:
                if entry.get("idempotency_key") == idem and entry.get("user_mobile") == mobile:
                    # Already processed
                    return UnifiedWalletService.get_wallet_state(all_data, mobile)

            # Calculate available balance
            bal_paise = user.get("balance_paise", to_paise(user.get("balance", 0.0)))
            exp_paise = user.get("exposure_paise", to_paise(user.get("exposure", 0.0)))
            res_paise = user.get("reserved_withdrawal_paise", 0)
            avail_paise = bal_paise - exp_paise - res_paise

            if avail_paise < amount_paise:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient available balance. Required: ₹{from_paise(amount_paise):,.2f}, Available: ₹{from_paise(avail_paise):,.2f}"
                )

            before_paise = bal_paise
            after_paise = bal_paise - amount_paise

            user["balance_paise"] = after_paise
            user["balance"] = from_paise(after_paise)

            now_str = time.strftime("%Y-%m-%d %H:%M:%S")
            tx_id = f"TX-{time.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

            tx_record = {
                "id": tx_id,
                "tx_id": tx_id,
                "ref_id": ref_id,
                "type": tx_type,
                "game_or_market": game_or_market,
                "description": description,
                "amount": from_paise(amount_paise),
                "amount_paise": amount_paise,
                "balance_before": from_paise(before_paise),
                "balance_after": from_paise(after_paise),
                "status": "COMPLETED",
                "date": now_str,
                "timestamp": int(time.time()),
                "idempotency_key": idem
            }

            user.setdefault("transactions", []).insert(0, tx_record)
            ledger.insert(0, {
                **tx_record,
                "user_mobile": mobile,
                "direction": "DEBIT",
                "actor": "system"
            })

            return UnifiedWalletService.get_wallet_state(all_data, mobile)

    @staticmethod
    async def credit(
        all_data: Dict[str, Any],
        mobile: str,
        amount_paise: int,
        tx_type: str,
        ref_id: str,
        game_or_market: str = "Pari-mutuel/Casino",
        description: str = "Winning payout credit",
        actor: str = "system",
        idempotency_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Atomically credits the user's unified balance.
        Enforces idempotency and records immutable ledger.
        """
        if amount_paise <= 0:
            raise HTTPException(status_code=400, detail="Credit amount must be greater than zero")

        lock = get_user_lock(mobile)
        async with lock:
            user = all_data.get("users", {}).get(mobile)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            idem = idempotency_key or f"{tx_type}-{ref_id}"
            ledger = all_data.setdefault("ledger", [])
            for entry in ledger:
                if entry.get("idempotency_key") == idem and entry.get("user_mobile") == mobile:
                    # Idempotent: already credited, return current state without duplicate
                    return UnifiedWalletService.get_wallet_state(all_data, mobile)

            bal_paise = user.get("balance_paise", to_paise(user.get("balance", 0.0)))
            before_paise = bal_paise
            after_paise = bal_paise + amount_paise

            user["balance_paise"] = after_paise
            user["balance"] = from_paise(after_paise)

            if tx_type in ["BET_WIN", "CASINO_WIN"]:
                user["total_winnings"] = round(user.get("total_winnings", 0.0) + from_paise(amount_paise), 2)

            now_str = time.strftime("%Y-%m-%d %H:%M:%S")
            tx_id = f"TX-{time.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

            tx_record = {
                "id": tx_id,
                "tx_id": tx_id,
                "ref_id": ref_id,
                "type": tx_type,
                "game_or_market": game_or_market,
                "description": description,
                "amount": from_paise(amount_paise),
                "amount_paise": amount_paise,
                "balance_before": from_paise(before_paise),
                "balance_after": from_paise(after_paise),
                "status": "COMPLETED",
                "date": now_str,
                "timestamp": int(time.time()),
                "actor": actor,
                "idempotency_key": idem,
                "metadata": metadata or {}
            }

            user.setdefault("transactions", []).insert(0, tx_record)
            ledger.insert(0, {
                **tx_record,
                "user_mobile": mobile,
                "direction": "CREDIT"
            })

            return UnifiedWalletService.get_wallet_state(all_data, mobile)

    @staticmethod
    async def reserve_withdrawal(
        all_data: Dict[str, Any],
        mobile: str,
        amount_paise: int,
        req_id: str,
        notes: str = ""
    ) -> Dict[str, Any]:
        """
        Reserves funds for a pending withdrawal request so they cannot be spent.
        """
        lock = get_user_lock(mobile)
        async with lock:
            user = all_data.get("users", {}).get(mobile)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            bal_paise = user.get("balance_paise", to_paise(user.get("balance", 0.0)))
            exp_paise = user.get("exposure_paise", 0)
            res_paise = user.get("reserved_withdrawal_paise", 0)
            avail_paise = bal_paise - exp_paise - res_paise

            if avail_paise < amount_paise:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient available balance to withdraw ₹{from_paise(amount_paise):,.2f}"
                )

            user["reserved_withdrawal_paise"] = res_paise + amount_paise
            return UnifiedWalletService.get_wallet_state(all_data, mobile)

    @staticmethod
    async def cancel_withdrawal(
        all_data: Dict[str, Any],
        mobile: str,
        amount_paise: int,
        req_id: str,
        reason: str,
        actor: str = "admin"
    ) -> Dict[str, Any]:
        """
        Releases reserved funds when admin rejects a withdrawal.
        """
        lock = get_user_lock(mobile)
        async with lock:
            user = all_data.get("users", {}).get(mobile)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            res_paise = user.get("reserved_withdrawal_paise", 0)
            user["reserved_withdrawal_paise"] = max(0, res_paise - amount_paise)

            now_str = time.strftime("%Y-%m-%d %H:%M:%S")
            tx_id = f"TX-REV-{uuid.uuid4().hex[:6].upper()}"
            tx_record = {
                "id": tx_id,
                "tx_id": tx_id,
                "ref_id": req_id,
                "type": "WITHDRAWAL_REFUND",
                "game_or_market": "Payout",
                "description": f"Withdrawal rejected: {reason}",
                "amount": from_paise(amount_paise),
                "amount_paise": amount_paise,
                "balance_before": from_paise(user["balance_paise"]),
                "balance_after": from_paise(user["balance_paise"]),
                "status": "REJECTED",
                "date": now_str,
                "actor": actor
            }
            user.setdefault("transactions", []).insert(0, tx_record)
            all_data.setdefault("ledger", []).insert(0, {
                **tx_record,
                "user_mobile": mobile,
                "direction": "RELEASE"
            })
            return UnifiedWalletService.get_wallet_state(all_data, mobile)

    @staticmethod
    async def commit_withdrawal(
        all_data: Dict[str, Any],
        mobile: str,
        amount_paise: int,
        req_id: str,
        utr_or_ref: str,
        actor: str = "admin"
    ) -> Dict[str, Any]:
        """
        Finalizes an approved withdrawal: deducts both balance and reservation.
        """
        lock = get_user_lock(mobile)
        async with lock:
            user = all_data.get("users", {}).get(mobile)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            bal_paise = user.get("balance_paise", to_paise(user.get("balance", 0.0)))
            res_paise = user.get("reserved_withdrawal_paise", 0)

            before_paise = bal_paise
            after_paise = max(0, bal_paise - amount_paise)
            user["balance_paise"] = after_paise
            user["balance"] = from_paise(after_paise)
            user["reserved_withdrawal_paise"] = max(0, res_paise - amount_paise)

            now_str = time.strftime("%Y-%m-%d %H:%M:%S")
            tx_id = f"TX-WDR-{uuid.uuid4().hex[:6].upper()}"
            tx_record = {
                "id": tx_id,
                "tx_id": tx_id,
                "ref_id": req_id,
                "type": "WITHDRAWAL",
                "game_or_market": "Bank Payout",
                "description": f"Withdrawal approved by {actor}. Ref/UTR: {utr_or_ref}",
                "amount": from_paise(amount_paise),
                "amount_paise": amount_paise,
                "balance_before": from_paise(before_paise),
                "balance_after": from_paise(after_paise),
                "status": "COMPLETED",
                "date": now_str,
                "actor": actor
            }
            user.setdefault("transactions", []).insert(0, tx_record)
            all_data.setdefault("ledger", []).insert(0, {
                **tx_record,
                "user_mobile": mobile,
                "direction": "DEBIT"
            })
            return UnifiedWalletService.get_wallet_state(all_data, mobile)
