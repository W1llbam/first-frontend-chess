import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import chess

from app.models import (
    CreateInviteRequest,
    CreateInviteResponse,
    InviteResponse,
    JoinMatchResponse,
    MatchStatusResponse,
    MoveRequest,
    MoveResponse,
)

INVITE_LIFETIME = timedelta(minutes=10)
STARTING_FEN = chess.Board().fen()


class MatchMoveError(Exception):
    """Base class for expected move-submission failures."""


class MatchNotFoundError(MatchMoveError):
    pass


class MatchNotReadyError(MatchMoveError):
    pass


class WrongTurnError(MatchMoveError):
    pass


class InvalidMoveInputError(MatchMoveError):
    pass


class IllegalMoveError(MatchMoveError):
    pass


class GameOverError(MatchMoveError):
    pass


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
                    opponent_color TEXT,
                    fen TEXT,
                    move_count INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS match_moves (
                    match_id TEXT NOT NULL,
                    move_number INTEGER NOT NULL,
                    from_square TEXT NOT NULL,
                    to_square TEXT NOT NULL,
                    promotion TEXT,
                    san TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (match_id, move_number)
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
                ("fen", "TEXT"),
                ("move_count", "INTEGER NOT NULL DEFAULT 0"),
            ):
                if column not in columns:
                    connection.execute(f"ALTER TABLE matches ADD COLUMN {column} {definition}")
            connection.execute(
                "UPDATE matches SET fen = ? WHERE fen IS NULL",
                (STARTING_FEN,),
            )
            connection.execute(
                "UPDATE matches SET move_count = 0 WHERE move_count IS NULL",
            )

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
                    creator_token, creator_color, fen, move_count
                ) VALUES (?, ?, ?, 1, 'waiting', ?, ?, ?, 0)
                """,
                (
                    match_id,
                    invite.id,
                    creator_color,
                    creator_token,
                    creator_color,
                    STARTING_FEN,
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
                       creator_color, opponent_color, first_color,
                       fen, move_count
                FROM matches
                WHERE id = ?
                """,
                (match_id,),
            ).fetchone()
            if row is None:
                return None

            color = self._color_for_token(row, player_token)
            if color is None:
                return None

            return self._match_status(connection, row, color)

    def apply_move(
        self, match_id: str, player_token: str, request: MoveRequest
    ) -> MatchStatusResponse:
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                """
                SELECT id, status, creator_token, opponent_token,
                       creator_color, opponent_color, first_color,
                       fen, move_count
                FROM matches
                WHERE id = ?
                """,
                (match_id,),
            ).fetchone()

            if row is None:
                raise MatchNotFoundError("This match could not be found.")

            color = self._color_for_token(row, player_token)
            if color is None:
                raise MatchNotFoundError("This player is not part of the match.")
            if row["status"] != "ready":
                raise MatchNotReadyError("The match is not ready for moves.")

            board = chess.Board(row["fen"])
            if board.is_game_over():
                raise GameOverError("This game is already over.")

            expected_color = "white" if board.turn == chess.WHITE else "black"
            if color != expected_color:
                raise WrongTurnError(f"It is {expected_color}'s turn.")

            try:
                move = chess.Move.from_uci(
                    f"{request.from_square}{request.to_square}{request.promotion or ''}"
                )
            except ValueError as caught_error:
                raise InvalidMoveInputError("The move squares are invalid.") from caught_error

            if move not in board.legal_moves:
                raise IllegalMoveError("This move is not legal.")

            san = board.san(move)
            board.push(move)
            move_number = row["move_count"] + 1
            connection.execute(
                """
                UPDATE matches
                SET fen = ?, move_count = ?
                WHERE id = ?
                """,
                (board.fen(), move_number, match_id),
            )
            connection.execute(
                """
                INSERT INTO match_moves (
                    match_id, move_number, from_square, to_square,
                    promotion, san, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    match_id,
                    move_number,
                    request.from_square,
                    request.to_square,
                    request.promotion,
                    san,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

            return self._match_status(connection, row, color, board.fen(), move_number)

    @staticmethod
    def _color_for_token(row: sqlite3.Row, player_token: str) -> str | None:
        if player_token == row["creator_token"]:
            return row["creator_color"] or row["first_color"]
        if player_token == row["opponent_token"]:
            return row["opponent_color"]
        return None

    @staticmethod
    def _match_status(
        connection: sqlite3.Connection,
        row: sqlite3.Row,
        color: str,
        fen: str | None = None,
        move_count: int | None = None,
    ) -> MatchStatusResponse:
        current_fen = fen if fen is not None else row["fen"]
        current_move_count = move_count if move_count is not None else row["move_count"]
        last_move_row = connection.execute(
            """
            SELECT from_square, to_square, promotion, san
            FROM match_moves
            WHERE match_id = ?
            ORDER BY move_number DESC
            LIMIT 1
            """,
            (row["id"],),
        ).fetchone()
        last_move = None if last_move_row is None else MoveResponse(
            from_square=last_move_row["from_square"],
            to_square=last_move_row["to_square"],
            promotion=last_move_row["promotion"],
            san=last_move_row["san"],
        )

        board = chess.Board(current_fen)
        return MatchStatusResponse(
            match_id=row["id"],
            color=color,
            status=row["status"],
            fen=current_fen,
            turn="white" if board.turn == chess.WHITE else "black",
            move_count=current_move_count,
            last_move=last_move,
        )
