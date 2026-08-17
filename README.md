# Chess With Friends

## Run the application

Install the frontend dependencies once:

```powershell
cd frontend
npm install
```

Start the frontend:

```powershell
npm run dev
```

In a second terminal, install and start the backend:

```powershell
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The Vite development server forwards `/api` requests to the backend at `http://127.0.0.1:8000`. FastAPI's interactive API documentation is available at `http://127.0.0.1:8000/docs`.

## Verification checks

Run these commands from the repository root:

```powershell
npm run test:frontend
npm run lint
npm run build:frontend
npm run test:backend
```

The frontend commands can also be run directly from `frontend`:

```powershell
cd frontend
npm test
npm run lint
npm run build
```

The backend test command requires the backend environment to be installed with `uv sync`:

```powershell
npm run test:backend
```

## Project structure

- `frontend/` contains the React, TypeScript, and Vite application.
- `backend/` contains the FastAPI application and SQLite persistence.
- `tests/frontend/` contains frontend tests.
- `tests/backend/` contains backend tests.
