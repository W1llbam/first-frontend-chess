# Development Guide

This guide describes the local development workflow for Chess With Friends. It focuses on the current implementation and keeps the frontend and backend commands explicit about their working directories.

## Repository layout

```text
frontend/       React, TypeScript, and Vite application
backend/        FastAPI application, Pydantic models, and SQLite persistence
tests/frontend/ Frontend tests using Vitest and Testing Library
tests/backend/  Backend tests using pytest and FastAPI TestClient
docs/           Project documentation
```

Within the frontend:

- `src/pages/` contains route-level screens.
- `src/components/` contains reusable UI components.
- `src/api/` contains the client functions used to call the backend.
- `src/chess/` contains frontend chessboard and legal-target helpers.

Within the backend:

- `app/main.py` defines the FastAPI application and HTTP routes.
- `app/models.py` defines request and response models.
- `app/database.py` owns SQLite initialization, persistence, invite handling, and server-side move validation.

## Start the application

Install frontend dependencies from `frontend`:

```powershell
cd frontend
npm install
```

Start the frontend from `frontend`:

```powershell
npm run dev
```

In a second terminal, install backend dependencies from `backend`:

```powershell
cd backend
uv sync
```

Start the backend from `backend`:

```powershell
uv run uvicorn app.main:app --reload
```

The Vite server proxies requests beginning with `/api` to `http://127.0.0.1:8000`. FastAPI's generated interactive API documentation is available at `/docs` on the backend server.

## Run verification checks

The canonical commands run from the repository root:

```powershell
npm run test:frontend
npm run lint
npm run build:frontend
npm run test:backend
```

The direct frontend commands run from `frontend`:

```powershell
cd frontend
npm test
npm run lint
npm run build
```

The backend environment must first be installed with `uv sync` from `backend`.

## Run focused tests

From the repository root, run one frontend test file with:

```powershell
npm --prefix frontend test -- ../tests/frontend/pages/MatchPage.test.tsx
```

Run one backend test file with:

```powershell
uv run --directory backend pytest ../tests/backend/test_moves.py
```

Use pytest's `-k` option to select a backend test by name:

```powershell
uv run --directory backend pytest ../tests/backend -k promotion
```

The frontend tests cover application routing, match creation, invite joining, accessible board rendering, move submission, polling updates, and client-side session handling. The backend tests cover invite lifecycle, authentication by player token, legal and illegal moves, special moves, promotion, game-over rejection, persistence backfilling, and concurrent submissions.

## Development workflow

For a behavior change:

1. Locate the relevant page, component, API route, model, or database behavior.
2. Make the smallest focused change that satisfies the requirement.
3. Add or update tests when observable behavior changes.
4. Run the relevant focused tests while developing.
5. Run the complete verification commands from the repository root.
6. Inspect the final diff and confirm unrelated files were not changed.

## Project conventions

- Keep server-side validation authoritative. Frontend checks improve interaction feedback but must not replace backend validation.
- Prefer straightforward functional React components and explicit TypeScript types.
- Keep state local unless the application genuinely needs shared state.
- Keep database assumptions and API data shapes explicit rather than adding speculative fallback behavior.
- Prefer simple, direct solutions and avoid unnecessary dependencies or abstractions.
- Preserve unrelated existing behavior.
- Explain important design decisions when a change introduces an unfamiliar React, TypeScript, Python, FastAPI, or SQLite concept.

## Pull-request checklist

Before opening a pull request:

- [ ] The change is focused and unrelated behavior is preserved.
- [ ] Tests were added or updated when behavior changed.
- [ ] The relevant frontend and backend checks pass.
- [ ] Documentation was updated if commands, public behavior, or setup changed.
- [ ] The final diff contains no accidental generated files or unrelated edits.
