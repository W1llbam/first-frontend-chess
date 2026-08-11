import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.models import (
    CreateInviteRequest,
    CreateInviteResponse,
    InviteResponse,
    JoinMatchResponse,
    MatchStatusResponse,
)

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
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS matches (
                    id TEXT PRIMARY KEY,
                    invite_id TEXT NOT NULL UNIQUE,
                    first_color TEXT NOT NULL,
                    player_count INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    creator_token TEXT,
                    opponent_token TEXT,
                    creator_color TEXT,
                    opponent_color TEXT
                )
                """
            )
            columns = {
                row[1]
                for row in connection.execute("PRAGMA table_info(matches)").fetchall()
            }
            for column, definition in (
                ("creator_token", "TEXT"),
                ("opponent_token", "TEXT"),
                ("creator_color", "TEXT"),
                ("opponent_color", "TEXT"),
            ):
                if column not in columns:
                    connection.execute(f"ALTER TABLE matches ADD COLUMN {column} {definition}")

    def create_invite(
        self, request: CreateInviteRequest, now: datetime | None = None
    ) -> CreateInviteResponse:
        created_at = now or datetime.now(timezone.utc)
        expires_at = created_at + INVITE_LIFETIME
        creator_color = (
            secrets.choice(("white", "black"))
            if request.color.value == "random"
            else request.color.value
        )
        match_id = secrets.token_urlsafe(24)
        creator_token = secrets.token_urlsafe(32)
        invite = CreateInviteResponse(
            id=secrets.token_urlsafe(24),
            status="pending",
            color=request.color,
            time_control=request.time_control,
            expires_at=expires_at,
            match_id=match_id,
            creator_token=creator_token,
            creator_color=creator_color,
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
            connection.execute(
                """
                INSERT INTO matches (
                    id, invite_id, first_color, player_count, status,
                    creator_token, creator_color
                ) VALUES (?, ?, ?, 1, 'waiting', ?, ?)
                """,
                (
                    match_id,
                    invite.id,
                    creator_color,
                    creator_token,
                    creator_color,
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

    def is_creator_token(self, invite_id: str, player_token: str) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT creator_token FROM matches WHERE invite_id = ?",
                (invite_id,),
            ).fetchone()
        return row is not None and row["creator_token"] == player_token

    def join_invite(
        self, invite: InviteResponse
    ) -> JoinMatchResponse | None:
        """Add one anonymous opponent to an invite, or return None if it is full."""
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            match = connection.execute(
                """
                SELECT id, first_color, player_count, opponent_token, opponent_color
                FROM matches
                WHERE invite_id = ?
                """,
                (invite.id,),
            ).fetchone()

            if match is None:
                return None

            if match["player_count"] >= 2:
                return None

            second_color = "black" if match["first_color"] == "white" else "white"
            opponent_token = secrets.token_urlsafe(32)
            connection.execute(
                """
                UPDATE matches
                SET player_count = 2, status = 'ready',
                    opponent_token = ?, opponent_color = ?
                WHERE id = ?
                """,
                (opponent_token, second_color, match["id"]),
            )
            return JoinMatchResponse(
                match_id=match["id"],
                player_token=opponent_token,
                color=second_color,
                status="ready",
            )

    def get_match_for_token(
        self, match_id: str, player_token: str
    ) -> MatchStatusResponse | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, status, creator_token, opponent_token,
                       creator_color, opponent_color, first_color
                FROM matches
                WHERE id = ?
                """,
                (match_id,),
            ).fetchone()

        if row is None:
            return None

        if player_token == row["creator_token"]:
            color = row["creator_color"] or row["first_color"]
        elif player_token == row["opponent_token"]:
            color = row["opponent_color"]
        else:
            return None

        return MatchStatusResponse(
            match_id=row["id"],
            color=color,
            status=row["status"],
        )
