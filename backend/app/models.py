from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ColorChoice(StrEnum):
    WHITE = "white"
    BLACK = "black"
    RANDOM = "random"


class TimeControl(StrEnum):
    UNLIMITED = "unlimited"
    TEN_MINUTES = "10-minutes"
    FIVE_MINUTES = "5-minutes"


class CreateInviteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    color: ColorChoice
    time_control: TimeControl = Field(alias="timeControl")


class InviteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    status: str
    color: ColorChoice
    time_control: TimeControl = Field(alias="timeControl")
    expires_at: datetime = Field(alias="expiresAt")


class CreateInviteResponse(InviteResponse):
    match_id: str = Field(alias="matchId")
    creator_token: str = Field(alias="creatorToken")
    creator_color: ColorChoice = Field(alias="creatorColor")


class JoinMatchResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    match_id: str = Field(alias="matchId")
    player_token: str = Field(alias="playerToken")
    color: ColorChoice
    status: str


class MatchStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    match_id: str = Field(alias="matchId")
    color: ColorChoice
    status: str
