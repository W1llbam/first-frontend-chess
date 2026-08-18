from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect, status

from app.database import (
    GameOverError,
    IllegalMoveError,
    InvalidMoveInputError,
    InviteDatabase,
    MatchNotFoundError,
    MatchNotReadyError,
    WrongTurnError,
)
from app.models import (
    CreateInviteRequest,
    CreateInviteResponse,
    InviteResponse,
    JoinMatchResponse,
    MatchStatusResponse,
    MoveRequest,
)
from app.realtime import MatchConnection, MatchConnectionManager

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "data" / "chess.db"


def create_app(database_path: Path | str = DEFAULT_DATABASE_PATH) -> FastAPI:
    app = FastAPI(title="Chess With Friends API")
    database = InviteDatabase(database_path)
    connections = MatchConnectionManager()

    @app.post(
        "/api/invites",
        response_model=CreateInviteResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_invite(request: CreateInviteRequest) -> CreateInviteResponse:
        return database.create_invite(request)

    @app.get("/api/invites/{invite_id}", response_model=InviteResponse)
    def get_invite(invite_id: str) -> InviteResponse:
        invite = database.get_invite(invite_id)
        if invite is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

        if invite.expires_at <= datetime.now(timezone.utc):
            database.expire_invite(invite_id)
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invite has expired.",
            )

        if invite.status == "expired":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invite has expired.",
            )

        return invite

    @app.post(
        "/api/invites/{invite_id}/join",
        response_model=JoinMatchResponse,
    )
    async def join_invite(
        invite_id: str,
        player_token: str | None = Header(default=None, alias="X-Player-Token"),
    ) -> JoinMatchResponse:
        invite = database.get_invite(invite_id)
        if invite is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

        if invite.expires_at <= datetime.now(timezone.utc):
            database.expire_invite(invite_id)
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invite has expired.",
            )

        if invite.status == "expired":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invite has expired.",
            )

        if player_token is not None and database.is_creator_token(invite_id, player_token):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The invite creator cannot join their own match.",
            )

        match = database.join_invite(invite)
        if match is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This invite has already been joined.",
            )

        await connections.broadcast_snapshot(match.match_id, database)
        return match

    @app.get("/api/matches/{match_id}", response_model=MatchStatusResponse)
    def get_match_status(
        match_id: str,
        player_token: str | None = Header(default=None, alias="X-Player-Token"),
    ) -> MatchStatusResponse:
        if player_token is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

        match = database.get_match_for_token(match_id, player_token)
        if match is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

        return match

    @app.post(
        "/api/matches/{match_id}/moves",
        response_model=MatchStatusResponse,
    )
    async def submit_move(
        match_id: str,
        request: MoveRequest,
        player_token: str | None = Header(default=None, alias="X-Player-Token"),
    ) -> MatchStatusResponse:
        if player_token is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

        try:
            match = database.apply_move(match_id, player_token, request)
            await connections.broadcast_snapshot(match_id, database)
            return match
        except MatchNotFoundError as caught_error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(caught_error)) from caught_error
        except IllegalMoveError as caught_error:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(caught_error)) from caught_error
        except InvalidMoveInputError as caught_error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(caught_error)) from caught_error
        except (MatchNotReadyError, WrongTurnError, GameOverError) as caught_error:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(caught_error)) from caught_error

    @app.websocket("/api/matches/{match_id}/events")
    async def match_events(websocket: WebSocket, match_id: str) -> None:
        player_token = websocket.query_params.get("playerToken")
        if not player_token:
            await websocket.close(code=1008)
            return

        match = database.get_match_for_token(match_id, player_token)
        if match is None:
            await websocket.close(code=1008)
            return

        connection = MatchConnection(websocket, player_token)
        await websocket.accept()
        await connections.add(match_id, connection)
        try:
            await websocket.send_json({
                "type": "match.updated",
                "match": match.model_dump(by_alias=True),
            })
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            await connections.remove(match_id, connection)

    @app.on_event("shutdown")
    async def close_connections() -> None:
        await connections.close()

    return app


app = create_app()
