import logging
from fastapi import APIRouter, Depends

from app.middleware.auth import require_internal_token
from app.db import get_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal")


@router.post("/reset-monthly-gens")
async def reset_monthly_gens(auth: bool = Depends(require_internal_token)):
    """Reset generation counts for users whose reset period has passed.
    Call via cron: 0 0 1 * * curl -X POST -H 'X-Internal-Token: ...' https://api.flowin.one/internal/reset-monthly-gens
    """
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE users
            SET gens_used_this_month = 0,
                gens_reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month')
            WHERE gens_reset_at <= NOW()
            RETURNING id
        """)
        count = cur.rowcount

    logger.info("Reset monthly generation counts for %d users", count)
    return {"reset_count": count}
