# Chess With Friends

Chess With Friends is a learning project for building a browser-based chess game. Players create a private match, share an invite link, and play against one another on a server-validated board.

## Technology

- Frontend: React, TypeScript, and Vite.
- Backend: Python, FastAPI, and SQLite.
- Chess rules: `chess.js` in the frontend for interaction feedback and `python-chess` in the backend for authoritative validation.
- Testing: Vitest and Testing Library for the frontend; pytest for the backend.

## Run locally

Install the frontend dependencies from the repository root:

```powershell
cd frontend
npm install
```

Start the frontend from `frontend`:

```powershell
npm run dev
```

In a second terminal, install the backend environment from `backend`:

```powershell
cd backend
uv sync
```

Start the backend from `backend`:

```powershell
uv run uvicorn app.main:app --reload
```

The Vite development server forwards `/api` requests to `http://127.0.0.1:8000`. FastAPI's interactive API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

Once both servers are running, open the frontend, create a match, and share the invite link with the other player.

## Verification checks

Run the canonical checks from the repository root:

```powershell
npm run test:frontend
npm run lint
npm run build:frontend
npm run test:backend
```

The frontend checks can also be run directly from `frontend`:

```powershell
cd frontend
npm test
npm run lint
npm run build
```

The backend test command requires the backend environment to have been installed with `uv sync`.

## Project structure

- `frontend/` contains the React, TypeScript, and Vite application.
- `backend/` contains the FastAPI application and SQLite persistence.
- `tests/frontend/` contains frontend tests.
- `tests/backend/` contains backend tests.
- `docs/` contains development and future technical documentation.

## Documentation

- [Development guide](docs/development.md) — local workflow, tests, project conventions, and pull-request checks.
- [Architecture guide](docs/architecture.md) — frontend, backend, and match data flow.
- [API reference](docs/api.md) — current REST endpoints, schemas, and error responses.
- [Data model](docs/data-model.md) — SQLite tables, persistence, and startup compatibility behavior.
- [Chess domain guide](docs/chess-domain.md) — FEN, SAN, move validation, and chess-state flow.
- [Current limitations](docs/current-limitations.md) — factual product and technical limitations.

## Common issues

- If the frontend cannot reach `/api`, make sure the backend is running on `http://127.0.0.1:8000` and that the frontend was started with Vite.
- If a command cannot be found, check that it is being run from the directory shown in its code block. Root verification commands must be run from the repository root.
- Invites expire after ten minutes or become unavailable once another player has joined them. Create a new match when this happens.
- Match sessions are stored in browser `localStorage`. Clearing browser storage removes the local session needed to reopen that match in the same browser.
- A rejected move may be caused by the wrong player being selected, the wrong turn, or an illegal chess move. The backend is authoritative even when the frontend highlights possible destinations.
