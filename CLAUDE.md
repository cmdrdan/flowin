# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Flowin** is an AI-powered website builder that lets users create and publish sites to unique subdomains (`{slug}.flowin.one`). It consists of a Python FastAPI backend and a vanilla JavaScript frontend with Monaco Editor.

## Repository Structure

```
/opt/
├── flowin-api/          # Python FastAPI backend (single-file API)
│   ├── main.py          # All API logic: /publish and /generate endpoints
│   ├── requirements.txt # fastapi, uvicorn
│   └── venv/            # Python 3.10 virtual environment
├── flowin/www/          # Frontend static sites
│   ├── editor.flowin.one/  # Main editor app (app.js + Monaco Editor)
│   ├── flowin.one/         # Landing page
│   └── flowin-sites/       # Published user sites (generated HTML files)
├── apps/frontend/       # Empty Python package placeholder
└── setup-flowin-vps.sh  # VPS deployment script (Nginx, SSL, UFW)
```

## Architecture

**Request flow:** Editor frontend (`editor.flowin.one`) -> FastAPI API (`api.flowin.one`) -> Filesystem (`/var/www/flowin-sites/{slug}/index.html`) -> Nginx wildcard subdomain serving (`{slug}.flowin.one`)

**Backend** (`flowin-api/main.py`):
- `POST /publish` — Accepts raw HTML body, optional `?slug=` query param. Auto-generates slugs as `{adjective}-{noun}-{number}`. Writes to `/var/www/flowin-sites/{slug}/index.html`.
- `POST /generate` — Accepts `{"prompt": "..."}`, calls OpenAI GPT-3.5-turbo, returns `{"html": "..."}`.
- CORS: Only allows POST from `https://editor.flowin.one`.

**Frontend** (`flowin/www/editor.flowin.one/app.js`):
- Two modes: **AI Mode** (guided form -> AI generation) and **Manual Mode** (direct HTML editing).
- Uses Supabase JS SDK for optional database features (forms, accounts, etc.).
- Monaco Editor for code editing with live iframe preview.
- Tailwind CSS via CDN for styling.
- Client-side state object tracks site config (purpose, features, color scheme, etc.).

## Development Commands

### Backend API
```bash
cd /opt/flowin-api
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload          # Dev server
```

### Environment Variables
- `OPENAI_API_KEY` — Required for the `/generate` endpoint.

### Frontend
No build step — static HTML/JS/CSS served directly. Edit files in `flowin/www/editor.flowin.one/`.

### Deployment
- `setup-flowin-vps.sh` — Full VPS setup: Nginx wildcard config, Let's Encrypt SSL for `*.flowin.one`, UFW firewall.
- Published sites are plain HTML in `/var/www/flowin-sites/{slug}/index.html`, served by Nginx.

## Key Details

- No test suite, linting config, or CI/CD pipeline exists.
- No `.env` file — environment variables set at OS level.
- `openai` package is used in `main.py` but missing from `requirements.txt`.
- Supabase credentials (URL + anon key) are embedded in `app.js`.
- The `main.py.save` file is a backup of an older version with a hardcoded API key.
