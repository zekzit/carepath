# Hackathon Starter

Initial scaffold: **Next.js** (frontend) + **Django** (backend) + **SQLite** (database).

## Quick start

Run both dev servers together with [Task](https://taskfile.dev) (`brew install go-task`):

```bash
task dev
```

This starts Django on `:8000` and Next.js on `:3000`. Open `http://localhost:3000`. Ctrl+C stops both. See `Taskfile.yml`. First-time setup (venv, `pip install`, `npm install`, `migrate`) is still manual — see below.

## Structure

```
frontend/   Next.js (App Router, TypeScript, Tailwind)
backend/    Django + Django REST Framework, SQLite
```

## Backend setup

```bash
cd backend
source venv/bin/activate   # venv already created; on Windows: venv\Scripts\activate
python manage.py migrate
python manage.py createsuperuser   # optional, for /admin/
python manage.py runserver 8000
```

API is normally reached through the frontend's proxy (see below), but you can also hit Django directly:
Sample endpoint: `GET http://localhost:8000/api/health` → `{"status": "ok"}`

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:3000` — **use `localhost`, not `127.0.0.1`** (Next.js dev server blocks cross-origin dev requests otherwise).

### Same-origin API proxy

The frontend and backend are served from a single origin (`http://localhost:3000`): Next.js rewrites any request to `/api/*` to the Django server (`frontend/next.config.ts`), so the browser never talks to Django directly and there's no CORS to configure. The Django URL for the rewrite target is set with `BACKEND_URL` in `frontend/.env.local` (copied from `.env.local.example`), defaulting to `http://127.0.0.1:8000`.

Call the API from the frontend with a relative path, e.g. `fetch("/api/health")` (see `frontend/app/page.tsx`).

**No trailing slashes on API routes.** Next.js's rewrite strips the trailing slash from wildcard path segments, so Django routes are defined without one (`core/urls.py`) and `APPEND_SLASH = False` is set in `backend/config/settings.py` so Django doesn't redirect to add it back. Keep this convention for new endpoints.

In production, deploy Next.js as a Node server (not a static export) so the rewrite keeps working the same way — or replace it with an equivalent path-based rule in your reverse proxy (nginx/Caddy) if you deploy the two services separately.

## Adding features

- Backend: add apps with `python manage.py startapp <name>`, register in `backend/config/settings.py` `INSTALLED_APPS`, wire URLs in `backend/config/urls.py` without a trailing slash.
- Frontend: add routes under `frontend/app/`, call the backend with relative `/api/...` paths.
