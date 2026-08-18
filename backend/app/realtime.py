import asyncio
from dataclasses import dataclass

from fastapi import WebSocket

from app.database import InviteDatabase


@dataclass
class MatchConnection:
    websocket: WebSocket
    player_token: str


class MatchConnectionManager:
    """Tracks WebSocket clients for one FastAPI process."""

    def __init__(self) -> None:
        self._connections: dict[str, list[MatchConnection]] = {}
        self._lock = asyncio.Lock()

    async def add(self, match_id: str, connection: MatchConnection) -> None:
        async with self._lock:
            self._connections.setdefault(match_id, []).append(connection)

    async def remove(self, match_id: str, connection: MatchConnection) -> None:
        async with self._lock:
            connections = self._connections.get(match_id)
            if connections is None:
                return

            if connection in connections:
                connections.remove(connection)
            if not connections:
                self._connections.pop(match_id, None)

    async def broadcast_snapshot(
        self, match_id: str, database: InviteDatabase
    ) -> None:
        async with self._lock:
            connections = list(self._connections.get(match_id, ()))

        disconnected: list[MatchConnection] = []
        for connection in connections:
            snapshot = database.get_match_for_token(match_id, connection.player_token)
            if snapshot is None:
                disconnected.append(connection)
                continue

            try:
                await connection.websocket.send_json({
                    "type": "match.updated",
                    "match": snapshot.model_dump(by_alias=True),
                })
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            await self.remove(match_id, connection)

    async def close(self) -> None:
        async with self._lock:
            connections = [
                connection
                for match_connections in self._connections.values()
                for connection in match_connections
            ]
            self._connections.clear()

        for connection in connections:
            try:
                await connection.websocket.close()
            except Exception:
                pass
