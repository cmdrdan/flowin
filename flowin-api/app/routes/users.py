import logging
from fastapi import APIRouter, Depends

from app.middleware.auth import get_current_user
from app.services.tiers import get_user_with_tier, get_user_site_count
from app.db import get_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users")


@router.get("/me/stats")
async def user_stats(user: dict = Depends(get_current_user)):
    full_user = get_user_with_tier(user["id"])
    if not full_user:
        return {"error": "User not found"}

    tier = full_user["tier"]
    site_count = get_user_site_count(user["id"])

    return {
        "tier": tier,
        "gens_used": full_user["gens_used_this_month"],
        "gens_limit": tier["max_gens_month"],
        "gens_reset_at": full_user["gens_reset_at"],
        "sites_used": site_count,
        "sites_limit": tier["max_sites"],
        "subscription_status": full_user["subscription_status"],
        "email_verified": full_user["email_verified"],
    }


@router.get("/me/sites")
async def user_sites(user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT s.id, s.slug, s.title, s.created_at, s.updated_at,
                      s.slug_type, s.custom_domain, s.domain_verified
               FROM sites s WHERE s.user_id = %s ORDER BY s.updated_at DESC""",
            (user["id"],),
        )
        rows = cur.fetchall()

    from app.config import settings
    return {
        "sites": [
            {
                "id": r[0], "slug": r[1], "title": r[2],
                "created_at": r[3].isoformat(),
                "updated_at": r[4].isoformat() if r[4] else None,
                "slug_type": r[5], "custom_domain": r[6],
                "domain_verified": r[7],
                "url": f"https://{r[1]}.{settings.base_domain}",
            }
            for r in rows
        ]
    }


@router.get("/me/generations")
async def user_generations(user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, prompt, model, gen_type, tokens_in, tokens_out, created_at
               FROM generations WHERE user_id = %s
               ORDER BY created_at DESC LIMIT 20""",
            (user["id"],),
        )
        rows = cur.fetchall()

    return {
        "generations": [
            {
                "id": r[0], "prompt": r[1][:200] if r[1] else "",
                "model": r[2], "gen_type": r[3],
                "tokens_in": r[4], "tokens_out": r[5],
                "created_at": r[6].isoformat(),
            }
            for r in rows
        ]
    }


@router.get("/me/tier")
async def user_tier(user: dict = Depends(get_current_user)):
    full_user = get_user_with_tier(user["id"])
    if not full_user:
        return {"error": "User not found"}

    from app.services.tiers import get_all_tiers
    all_tiers = get_all_tiers(active_only=True)

    return {
        "current_tier": full_user["tier"],
        "subscription_status": full_user["subscription_status"],
        "available_tiers": all_tiers,
    }
