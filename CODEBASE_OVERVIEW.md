# Flowin — Codebase Overview

## What Is Flowin?

Flowin is a website builder and publishing platform hosted at `flowin.one`. Users create single-page HTML websites either by writing code manually or by describing what they want to an AI (OpenAI GPT-3.5-turbo), which generates the HTML. Published sites receive unique subdomains such as `sleepy-tornado-2.flowin.one`.

## Architecture

The project is a monorepo with two components:

| Component | Tech Stack | Location |
|---|---|---|
| **Backend API** | Python / FastAPI + Uvicorn | `flowin-api/` |
| **Frontend** | Vanilla HTML/JS, Tailwind CSS (CDN), Monaco Editor | `www/` |

### Backend — `flowin-api/main.py`

A single 132-line Python file providing two endpoints:

- **`POST /publish`** — Accepts a raw HTML body, writes it to disk at `/var/www/flowin-sites/<slug>/index.html`, and returns the public URL. Slugs can be user-supplied or auto-generated (e.g. `quirky-tornado-7`).
- **`POST /generate`** — Takes a text prompt, sends it to OpenAI GPT-3.5-turbo, extracts HTML from the Markdown-fenced response, and returns it as JSON.

CORS is restricted to `https://editor.flowin.one`.

### Frontend — `www/`

Four static sites organised by subdomain:

- **`flowin.one`** (`www/flowin.one/` and `www/flowin/`) — Landing page offering AI Mode and Manual Mode.
- **`editor.flowin.one`** (`www/editor.flowin.one/`) — The main editor UI containing:
  - A wizard-style intake form (site purpose, features, colour scheme, update frequency).
  - AI prompt builder that feeds intake answers into a GPT request.
  - Monaco code editor with a live `<iframe>` preview.
  - Publish button that POSTs HTML to the API.
  - Supabase integration stubs for database-backed features (auth, forms, calendar events, members, projects).
- **`www/flowin-sites/`** — Directory holding ~20 already-published sites (each an `index.html`).

### Key Files

| File | Purpose |
|---|---|
| `flowin-api/main.py` | Entire backend — publish + AI generation endpoints |
| `flowin-api/requirements.txt` | Python dependencies (incomplete — see below) |
| `www/editor.flowin.one/app.js` | ~1 200-line JS file powering the editor, intake wizard, Supabase provisioning stubs, and publish flow |
| `www/editor.flowin.one/index.html` | Editor page markup |
| `www/flowin.one/index.html` | Public landing page |
| `www/flowin/index.html` | Alternate landing page (relative links variant) |

## Production Readiness Assessment

**Not production-ready.** Flowin is an early-stage prototype with the following gaps:

### Security

- **API key leaked**: `main.py:104` prints the OpenAI API key to stdout (`print("DEBUG: OpenAI key =", ...)`).
- **Supabase anon key hardcoded** in `app.js:7`.
- **No authentication or authorisation** on the API — anyone can publish arbitrary HTML.
- **Arbitrary HTML hosting** enables XSS, phishing, or malicious content under the `flowin.one` domain.
- **No rate limiting** on any endpoint.
- **No content size limits** on published HTML.

### Code Quality

- Duplicate imports and redefined constants in `main.py` (`FastAPI`, `os`, `SITES_DIR`, `BASE_DOMAIN`).
- Entire backend lives in a single file with no separation of concerns.
- `requirements.txt` lists `fastapi` and `uvicorn` but omits `openai` and `pydantic`.
- `venv/` and `__pycache__/` are committed to the repository; `.gitignore` only covers `*.save`.

### Missing Infrastructure

- **No tests** of any kind.
- **No CI/CD pipeline** (no GitHub Actions, no Dockerfile, no deployment scripts).
- **No logging or monitoring** — only a debug print statement.
- **No environment variable management** (no `.env.example`).
- **No database migrations** — Supabase schemas are defined as JS objects in `app.js` with no migration tooling.
- **Filesystem-based storage** (`/var/www/flowin-sites`) prevents horizontal scaling and has no backup strategy.
- **CDN dependencies** (Tailwind, Monaco) are unpinned with no fallbacks.

## Summary

Flowin demonstrates a compelling concept — AI-assisted website building with instant one-click publishing. The user experience flow (intake wizard → AI generation → code editor → publish) is thoughtful and functional. However, substantial work is needed before production use: authentication, input validation, secrets management, tests, CI/CD, and operational infrastructure are all absent.
