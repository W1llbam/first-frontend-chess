# REST API Reference

This document describes the current REST API and match event WebSocket. The API is served under `/api` by FastAPI.

## Conventions

- Request and response bodies use JSON.
- Fields with Pydantic aliases use camelCase in JSON, such as `timeControl`, `matchId`, and `lastMove`.
- Player-authenticated endpoints use the `X-Player-Token` header.
- Tokens are returned when an invite is created or joined and are then sent by the browser on match requests.
- Expected errors use FastAPI's `{ "detail": "..." }` response shape when a specific detail is available.
- Invite identifiers, match identifiers, and tokens in examples are placeholders.

## `POST /api/invites`

Creates a private invite and its waiting match. No authentication is required.

Request:

```json
{
  "color": "random",
  "timeControl": "unlimited"
}
```

Valid values:

- `color`: `white`, `black`, or `random`;
- `timeControl`: `unlimited`, `10-minutes`, or `5-minutes`.

Successful response: `201 Created`

```json
{
  "id": "invite-id",
  "status": "pending",
  "color": "random",
  "timeControl": "unlimited",
  "expiresAt": "2026-08-18T12:10:00+00:00",
  "matchId": "match-id",
  "creatorToken": "creator-token",
  "creatorColor": "white"
}
```

The backend generates the invite and match identifiers, the creator token, and the creator's resolved color. Invites expire ten minutes after creation. The time-control selection is stored, but clocks are not currently implemented.

Errors:

- `422 Unprocessable Entity` when the request contains an unsupported color, time control, or otherwise invalid data.

## `GET /api/invites/{inviteId}`

Returns public information about an invite. No authentication is required.

Successful response: `200 OK`

```json
{
  "id": "invite-id",
  "status": "pending",
  "color": "random",
  "timeControl": "unlimited",
  "expiresAt": "2026-08-18T12:10:00+00:00"
}
```

Errors:

- `404 Not Found` when the invite does not exist;
- `410 Gone` when the invite has expired.

The backend checks the expiration timestamp when the invite is fetched and marks an expired invite accordingly.

## `POST /api/invites/{inviteId}/join`

Adds one anonymous opponent to a pending invite. The request body is empty.

Optional header:

```text
X-Player-Token: existing-player-token
```

The header is used to prevent the creator from joining their own invite. A normal opponent does not send a token.

Successful response: `200 OK`

```json
{
  "matchId": "match-id",
  "playerToken": "opponent-token",
  "color": "black",
  "status": "ready"
}
```

The opponent receives the color opposite the creator's color. The creator does not call this endpoint to enter their own match; the creator session is returned by the invite-creation endpoint.

Errors:

- `404 Not Found` when the invite does not exist;
- `409 Conflict` when the creator attempts to join their own invite or the invite already has two players;
- `410 Gone` when the invite has expired.

## `GET /api/matches/{matchId}`

Returns the current match state for one of its players.

Required header:

```text
X-Player-Token: player-token
```

Successful response: `200 OK`

```json
{
  "matchId": "match-id",
  "color": "white",
  "status": "ready",
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "turn": "black",
  "moveCount": 1,
  "gameStatus": "active",
  "winner": null,
  "drawReason": null,
  "lastMove": {
    "from": "e2",
    "to": "e4",
    "promotion": null,
    "san": "e4"
  }
}
```

Response fields:

- `matchId`: match identifier;
- `color`: the requesting player's color;
- `status`: currently `waiting` or `ready`;
- `fen`: complete current board state in Forsyth–Edwards Notation;
- `turn`: `white` or `black`;
- `moveCount`: number of accepted moves;
- `gameStatus`: `active`, `check`, `checkmate`, `stalemate`, or `draw`;
- `winner`: winning color for checkmate, otherwise `null`;
- `drawReason`: `stalemate`, `insufficient-material`, `fivefold-repetition`, or `seventy-five-move` for draws, otherwise `null`;
- `lastMove`: latest move, or `null` before the first move.

Errors:

- `401 Unauthorized` when the token header is missing;
- `404 Not Found` when the match does not exist or the token is not a player in the match.

The match page uses this endpoint for its initial load and as a two-second fallback while real-time events are unavailable.

## `GET /api/matches/{matchId}/events` (WebSocket)

Opens an authenticated real-time match update stream. Browser clients authenticate with the player token in the query string because native WebSockets cannot set the existing request header:

```text
ws(s)://host/api/matches/match-id/events?playerToken=player-token
```

The server validates the token before accepting the WebSocket. Missing, invalid, or non-player tokens are closed with WebSocket code `1008` before any match data is sent. After connection, and after each successful join or move, the server sends a complete player-specific snapshot:

```json
{
  "type": "match.updated",
  "match": {
    "matchId": "match-id",
    "color": "white",
    "status": "ready",
    "gameStatus": "active",
    "winner": null,
    "drawReason": null,
    "fen": "...",
    "turn": "black",
    "moveCount": 1,
    "lastMove": null
  }
}
```

The WebSocket does not accept moves. Clients continue to submit moves through the REST endpoint above. The frontend falls back to two-second status polling while reconnecting and refreshes the HTTP snapshot after a connection is restored.

## `POST /api/matches/{matchId}/moves`

Submits one move for the authenticated player.

Required header:

```text
X-Player-Token: player-token
```

Request:

```json
{
  "from": "e2",
  "to": "e4",
  "promotion": null
}
```

`promotion` may be `q`, `r`, `b`, or `n`. It is optional for ordinary moves and required when the submitted move is a pawn promotion.

Successful response: `200 OK`

The response is the complete updated `MatchStatusResponse` described above. Its `lastMove` may look like:

```json
{
  "from": "e2",
  "to": "e4",
  "promotion": null,
  "san": "e4"
}
```

The `san` field contains Standard Algebraic Notation. Current tests and supported examples include `e4`, `exd6`, `O-O`, and `e8=Q+`.

Errors:

- `401 Unauthorized` when the token header is missing;
- `404 Not Found` when the match does not exist or the token is not a player in the match;
- `409 Conflict` when the match is not ready, it is the other player's turn, the move is illegal, or the game is already over;
- `422 Unprocessable Entity` when move input is malformed or the promotion value is not one of the supported pieces.

The backend reconstructs the board from the stored FEN and validates the move with `python-chess`. Frontend legal-target highlighting does not replace this validation.

## Concurrent submissions

Move submission begins an SQLite `BEGIN IMMEDIATE` transaction before reading and updating the match. This serializes competing writes to the same database.

If both players or duplicate clients submit a move for the same turn at nearly the same time:

- only one valid submission is accepted;
- the other receives an expected conflict response, usually because the turn has changed;
- the persisted FEN, move count, and move history remain consistent.
