import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.models import CreateInviteRequest, InviteResponse

INVITE_LIFETIME = timedelta(minutes=10)


class InviteDatabase:
    def __init__(self, database_path: Path | str):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS invites (
                    id TEXT PRIMARY KEY,
                    color TEXT NOT NULL,
                    time_control TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL
                )
                """
            )

    def create_invite(
        self, request: CreateInviteRequest, now: datetime | None = None
    ) -> InviteResponse:
        created_at = now or datetime.now(timezone.utc)
        expires_at = created_at + INVITE_LIFETIME
        invite = InviteResponse(
            id=secrets.token_urlsafe(24),
            status="pending",
            color=request.color,
            time_control=request.time_control,
            expires_at=expires_at,
        )

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO invites (id, color, time_control, status, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    invite.id,
                    invite.color.value,
                    invite.time_control.value,
                    invite.status,
                    created_at.isoformat(),
                    invite.expires_at.isoformat(),
                ),
            )

        return invite

    def get_invite(self, invite_id: str) -> InviteResponse | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, color, time_control, status, expires_at
                FROM invites
                WHERE id = ?
                """,
                (invite_id,),
            ).fetchone()

        if row is None:
            return None

        return InviteResponse(
            id=row["id"],
            status=row["status"],
            color=row["color"],
            time_control=row["time_control"],
            expires_at=datetime.fromisoformat(row["expires_at"]),
        )

    def expire_invite(self, invite_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE invites SET status = 'expired' WHERE id = ?",
                (invite_id,),
            )
