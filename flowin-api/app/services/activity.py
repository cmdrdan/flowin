import json
import logging
from datetime import datetime, timezone

from app.db import get_conn

logger = logging.getLogger(__name__)

# File-based activity log
ACTIVITY_LOG_FILE = "/var/log/flowin/activity.log"


def log_activity(
    action: str,
    user_id: int | None = None,
    user_email: str = "",
    entity_type: str = "",
    entity_id: str = "",
    detail: dict | None = None,
    ip_address: str = "",
):
    """Log a user activity to both the database and the log file."""
    detail = detail or {}

    # DB insert
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO activity_log
                   (user_id, user_email, action, entity_type, entity_id, detail, ip_address)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (user_id, user_email, action, entity_type, entity_id,
                 json.dumps(detail), ip_address),
            )
    except Exception:
        logger.exception("Failed to write activity to DB")

    # File log
    try:
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "email": user_email,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "detail": detail,
            "ip": ip_address,
        }
        _write_log_line(json.dumps(entry, default=str))
    except Exception:
        logger.exception("Failed to write activity to log file")


def _write_log_line(line: str):
    import os
    os.makedirs(os.path.dirname(ACTIVITY_LOG_FILE), exist_ok=True)
    with open(ACTIVITY_LOG_FILE, "a") as f:
        f.write(line + "\n")


def get_activity_log(
    page: int = 1,
    limit: int = 50,
    user_id: int | None = None,
    action: str | None = None,
    entity_type: str | None = None,
) -> dict:
    """Query activity log from the database."""
    offset = (page - 1) * limit
    conditions = []
    params = []

    if user_id is not None:
        conditions.append("a.user_id = %s")
        params.append(user_id)
    if action:
        conditions.append("a.action = %s")
        params.append(action)
    if entity_type:
        conditions.append("a.entity_type = %s")
        params.append(entity_type)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""SELECT a.id, a.user_id, a.user_email, a.action,
                       a.entity_type, a.entity_id, a.detail,
                       a.ip_address, a.created_at
                FROM activity_log a
                {where}
                ORDER BY a.created_at DESC
                LIMIT %s OFFSET %s""",
            params + [limit, offset],
        )
        rows = cur.fetchall()

        cur.execute(f"SELECT COUNT(*) FROM activity_log a {where}", params)
        total = cur.fetchone()[0]

    return {
        "entries": [
            {
                "id": r[0],
                "user_id": r[1],
                "user_email": r[2],
                "action": r[3],
                "entity_type": r[4],
                "entity_id": r[5],
                "detail": r[6] if isinstance(r[6], dict) else {},
                "ip_address": r[7],
                "created_at": r[8].isoformat(),
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


def get_user_audit_trail(user_id: int, page: int = 1, limit: int = 50) -> dict:
    """Get all activity for a specific user."""
    return get_activity_log(page=page, limit=limit, user_id=user_id)
