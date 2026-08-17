from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, status

from app.database import InviteDatabase
from app.models import (
    CreateInviteRequest,
    CreateInviteResponse,
    InviteResponse,
    JoinMatchResponse,
    MatchStatusResponse,
)

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "data" / "chess.db"


def create_app(database_path: Path | str = DEFAULT_DATABASE_PATH) -> FastAPI:
    app = FastAPI(title="Chess With Friends API")
    database = InviteDatabase(database_path)

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
    def join_invite(
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

    return app


app = create_app()
