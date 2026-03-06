import logging
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

from app.config import settings

logger = logging.getLogger(__name__)

_pool: pool.SimpleConnectionPool | None = None


def init_pool():
    global _pool
    _pool = pool.SimpleConnectionPool(1, 10, settings.database_url)
    logger.info("Database connection pool initialized")


def close_pool():
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None
        logger.info("Database connection pool closed")


@contextmanager
def get_conn():
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def run_migrations():
    import os
    migrations_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migrations")
    if not os.path.isdir(migrations_dir):
        return

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        cur.execute("SELECT filename FROM _migrations")
        applied = {row[0] for row in cur.fetchall()}

        sql_files = sorted(f for f in os.listdir(migrations_dir) if f.endswith(".sql"))
        for filename in sql_files:
            if filename in applied:
                continue
            filepath = os.path.join(migrations_dir, filename)
            logger.info("Applying migration: %s", filename)
            with open(filepath) as f:
                cur.execute(f.read())
            cur.execute("INSERT INTO _migrations (filename) VALUES (%s)", (filename,))
        logger.info("All migrations applied")
