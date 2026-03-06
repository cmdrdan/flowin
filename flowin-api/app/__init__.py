import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_pool, close_pool, run_migrations
from app.routes import auth, publish, generate, sites, templates, domains, analytics, credentials

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="Flowin API", version="1.0.0")

    origins = [o.strip() for o in settings.cors_origins.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    app.include_router(auth.router)
    app.include_router(publish.router)
    app.include_router(generate.router)
    app.include_router(sites.router)
    app.include_router(templates.router)
    app.include_router(domains.router)
    app.include_router(analytics.router)
    app.include_router(credentials.router)

    @app.on_event("startup")
    async def startup():
        init_pool()
        run_migrations()
        logger.info("Flowin API started")

    @app.on_event("shutdown")
    async def shutdown():
        close_pool()
        logger.info("Flowin API stopped")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
