from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, status

from app.database import InviteDatabase
from app.models import CreateInviteRequest, InviteResponse

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "data" / "chess.db"


def create_app(database_path: Path | str = DEFAULT_DATABASE_PATH) -> FastAPI:
    app = FastAPI(title="Chess With Friends API")
    database = InviteDatabase(database_path)

    @app.post(
        "/api/invites",
        response_model=InviteResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_invite(request: CreateInviteRequest) -> InviteResponse:
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

    return app


app = create_app()
