import asyncio, json
from typing import Dict, Set
from fastapi import WebSocket

class WalletBroadcastManager:
    def __init__(self):
        # mobile -> set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.anonymous_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, mobile: str = ""):
        await websocket.accept()
        if mobile:
            if mobile not in self.active_connections:
                self.active_connections[mobile] = set()
            self.active_connections[mobile].add(websocket)
        else:
            self.anonymous_connections.add(websocket)

    def disconnect(self, websocket: WebSocket, mobile: str = ""):
        if mobile and mobile in self.active_connections:
            self.active_connections[mobile].discard(websocket)
            if not self.active_connections[mobile]:
                del self.active_connections[mobile]
        self.anonymous_connections.discard(websocket)

    async def broadcast_wallet(self, mobile: str, wallet_data: dict):
        """
        Pushes the updated wallet balance in real time to every open tab or device for this user.
        """
        payload = json.dumps({
            "type": "WALLET_SYNC",
            "mobile": mobile,
            "balance": wallet_data.get("balance", 0.0),
            "balance_paise": wallet_data.get("balance_paise", 0),
            "available": wallet_data.get("available", 0.0),
            "available_paise": wallet_data.get("available_paise", 0),
            "exposure": wallet_data.get("exposure", 0.0),
            "exposure_paise": wallet_data.get("exposure_paise", 0)
        })

        targets = list(self.active_connections.get(mobile, set()))
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                self.disconnect(ws, mobile)

wallet_broadcaster = WalletBroadcastManager()
