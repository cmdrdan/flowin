import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.db import get_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics")


class PageviewInput(BaseModel):
    slug: str
    path: str = "/"
    referrer: str = ""


@router.post("/pageview")
async def record_pageview(input: PageviewInput, request: Request):
    """Public endpoint — no auth needed. Called by tracking snippet in published sites."""
    user_agent = request.headers.get("user-agent", "")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM sites WHERE slug = %s", (input.slug,))
        site = cur.fetchone()
        if not site:
            return {"ok": False}

        cur.execute(
            """INSERT INTO page_views (site_id, path, referrer, user_agent)
               VALUES (%s, %s, %s, %s)""",
            (site[0], input.path, input.referrer, user_agent),
        )

    return {"ok": True}


@router.get("/sites/{slug}")
async def get_analytics(
    slug: str,
    period: str = "7d",
    user: dict = Depends(get_current_user),
):
    days_map = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(period, 7)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM sites WHERE slug = %s AND user_id = %s",
            (slug, user["id"]),
        )
        site = cur.fetchone()
        if not site:
            raise HTTPException(status_code=404, detail="Site not found")

        site_id = site[0]

        # Total views
        cur.execute(
            "SELECT COUNT(*) FROM page_views WHERE site_id = %s AND created_at >= %s",
            (site_id, cutoff),
        )
        total_views = cur.fetchone()[0]

        # Views by day
        cur.execute(
            """SELECT DATE(created_at) as day, COUNT(*)
               FROM page_views
               WHERE site_id = %s AND created_at >= %s
               GROUP BY day ORDER BY day""",
            (site_id, cutoff),
        )
        views_by_day = [
            {"date": row[0].isoformat(), "views": row[1]} for row in cur.fetchall()
        ]

        # Top referrers
        cur.execute(
            """SELECT referrer, COUNT(*) as cnt
               FROM page_views
               WHERE site_id = %s AND created_at >= %s AND referrer != ''
               GROUP BY referrer ORDER BY cnt DESC LIMIT 10""",
            (site_id, cutoff),
        )
        top_referrers = [
            {"referrer": row[0], "count": row[1]} for row in cur.fetchall()
        ]

        # Device breakdown (simple UA parsing)
        cur.execute(
            """SELECT
                 CASE
                   WHEN user_agent ILIKE '%%mobile%%' OR user_agent ILIKE '%%android%%' THEN 'mobile'
                   WHEN user_agent ILIKE '%%tablet%%' OR user_agent ILIKE '%%ipad%%' THEN 'tablet'
                   ELSE 'desktop'
                 END as device,
                 COUNT(*)
               FROM page_views
               WHERE site_id = %s AND created_at >= %s
               GROUP BY device""",
            (site_id, cutoff),
        )
        devices = {row[0]: row[1] for row in cur.fetchall()}

    return {
        "period": period,
        "total_views": total_views,
        "views_by_day": views_by_day,
        "top_referrers": top_referrers,
        "devices": devices,
    }
