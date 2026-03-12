import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from app.middleware.auth import require_admin
from app.db import get_conn
from app.services.tiers import get_all_tiers, update_tier, get_tier_by_id, get_tier_by_slug
from app.services import email as email_svc
from app.services.activity import log_activity, get_activity_log, get_user_audit_trail

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin")


# ── Stats ──────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.cursor()

        # User counts by tier
        cur.execute("""
            SELECT t.name, t.slug, t.price_monthly, COUNT(u.id) as user_count
            FROM tiers t
            LEFT JOIN users u ON u.tier_id = t.id
            GROUP BY t.id, t.name, t.slug, t.price_monthly
            ORDER BY t.display_order
        """)
        tier_stats = [
            {"name": r[0], "slug": r[1], "price_monthly": float(r[2]), "user_count": r[3]}
            for r in cur.fetchall()
        ]

        # MRR
        cur.execute("""
            SELECT COALESCE(SUM(t.price_monthly), 0)
            FROM users u
            JOIN tiers t ON t.id = u.tier_id
            WHERE u.subscription_status = 'active' AND t.price_monthly > 0
        """)
        mrr = float(cur.fetchone()[0])

        # Total users
        cur.execute("SELECT COUNT(*) FROM users")
        total_users = cur.fetchone()[0]

        # Free cap
        cur.execute("SELECT free_user_cap FROM site_settings WHERE id = 1")
        free_cap = cur.fetchone()[0]
        free_count = next((t["user_count"] for t in tier_stats if t["slug"] == "free"), 0)

        # Waitlist
        cur.execute("SELECT COUNT(*) FROM waitlist WHERE admitted = FALSE")
        waitlist_count = cur.fetchone()[0]

        # Total sites
        cur.execute("SELECT COUNT(*) FROM sites")
        total_sites = cur.fetchone()[0]

        # Gens this month
        cur.execute("""
            SELECT COUNT(*) FROM generations
            WHERE created_at >= DATE_TRUNC('month', NOW())
        """)
        gens_this_month = cur.fetchone()[0]

    return {
        "mrr": mrr,
        "total_users": total_users,
        "total_sites": total_sites,
        "gens_this_month": gens_this_month,
        "tier_stats": tier_stats,
        "free_users": free_count,
        "free_cap": free_cap,
        "waitlist_count": waitlist_count,
    }


# ── Users ──────────────────────────────────────────────────────

@router.get("/users")
async def admin_users(
    user: dict = Depends(require_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(""),
):
    offset = (page - 1) * limit

    with get_conn() as conn:
        cur = conn.cursor()

        where = ""
        params = []
        if search:
            where = "WHERE u.email ILIKE %s OR u.display_name ILIKE %s"
            params = [f"%{search}%", f"%{search}%"]

        cur.execute(
            f"""SELECT u.id, u.email, u.display_name, u.created_at,
                       t.name as tier_name, t.slug as tier_slug,
                       u.gens_used_this_month, u.subscription_status, u.is_admin,
                       u.email_verified,
                       (SELECT COUNT(*) FROM sites s WHERE s.user_id = u.id) as site_count
                FROM users u
                JOIN tiers t ON t.id = u.tier_id
                {where}
                ORDER BY u.created_at DESC
                LIMIT %s OFFSET %s""",
            params + [limit, offset],
        )
        rows = cur.fetchall()

        cur.execute(f"SELECT COUNT(*) FROM users u {where}", params)
        total = cur.fetchone()[0]

    users = [
        {
            "id": r[0], "email": r[1], "display_name": r[2],
            "created_at": r[3].isoformat(),
            "tier_name": r[4], "tier_slug": r[5],
            "gens_used": r[6], "subscription_status": r[7],
            "is_admin": r[8], "email_verified": r[9],
            "site_count": r[10],
        }
        for r in rows
    ]

    return {"users": users, "total": total, "page": page, "limit": limit}


class UserTierUpdate(BaseModel):
    tier_id: int


@router.patch("/users/{user_id}/tier")
async def admin_update_user_tier(
    user_id: int, body: UserTierUpdate, user: dict = Depends(require_admin)
):
    tier = get_tier_by_id(body.tier_id)
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET tier_id = %s WHERE id = %s RETURNING email",
            (body.tier_id, user_id),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info("Admin changed user %s tier to %s", user_id, tier["name"])
    log_activity(
        "admin_tier_change", user_id=user["id"], user_email=user["email"],
        entity_type="user", entity_id=str(user_id),
        detail={"target_user": user_id, "new_tier": tier["name"], "tier_id": body.tier_id},
    )
    return {"updated": True, "tier": tier["name"]}


# ── Tiers ──────────────────────────────────────────────────────

@router.get("/tiers")
async def admin_list_tiers(user: dict = Depends(require_admin)):
    return {"tiers": get_all_tiers(active_only=False)}


class TierUpdate(BaseModel):
    name: Optional[str] = None
    price_monthly: Optional[float] = None
    max_sites: Optional[int] = None
    max_gens_month: Optional[int] = None
    allows_custom_subdomain: Optional[bool] = None
    allows_custom_domain: Optional[bool] = None
    allows_db_apps: Optional[bool] = None
    show_ads: Optional[bool] = None
    features_list: Optional[list] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    stripe_price_id: Optional[str] = None


@router.patch("/tiers/{tier_id}")
async def admin_update_tier(
    tier_id: int, body: TierUpdate, user: dict = Depends(require_admin)
):
    data = body.model_dump(exclude_none=True)
    result = update_tier(tier_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Tier not found")
    return result


# ── Settings ───────────────────────────────────────────────────

@router.get("/settings")
async def admin_get_settings(user: dict = Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM site_settings WHERE id = 1")
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]

    return dict(zip(cols, row)) if row else {}


class SettingsUpdate(BaseModel):
    free_user_cap: Optional[int] = None
    free_user_budget_usd: Optional[float] = None
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None
    adsense_publisher_id: Optional[str] = None
    adsense_ad_unit_editor: Optional[str] = None
    adsense_ad_unit_sites: Optional[str] = None


@router.patch("/settings")
async def admin_update_settings(
    body: SettingsUpdate, user: dict = Depends(require_admin)
):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = [f"{k} = %s" for k in data]
    values = list(data.values())

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE site_settings SET {', '.join(set_parts)} WHERE id = 1",
            values,
        )

    logger.info("Admin updated settings: %s", list(data.keys()))
    return {"updated": True}


# ── Waitlist ───────────────────────────────────────────────────

@router.get("/waitlist")
async def admin_waitlist(
    user: dict = Depends(require_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    offset = (page - 1) * limit

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, email, created_at, admitted, admitted_at
               FROM waitlist
               ORDER BY admitted ASC, created_at ASC
               LIMIT %s OFFSET %s""",
            (limit, offset),
        )
        rows = cur.fetchall()

        cur.execute("SELECT COUNT(*) FROM waitlist WHERE admitted = FALSE")
        pending = cur.fetchone()[0]

    return {
        "entries": [
            {
                "id": r[0], "email": r[1],
                "created_at": r[2].isoformat(),
                "admitted": r[3],
                "admitted_at": r[4].isoformat() if r[4] else None,
            }
            for r in rows
        ],
        "pending_count": pending,
    }


@router.post("/waitlist/{entry_id}/admit")
async def admin_admit_one(entry_id: int, user: dict = Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE waitlist SET admitted = TRUE, admitted_at = NOW()
               WHERE id = %s AND admitted = FALSE
               RETURNING email""",
            (entry_id,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Waitlist entry not found or already admitted")

    await email_svc.send_welcome_email(row[0], "")
    logger.info("Admitted %s from waitlist", row[0])
    return {"admitted": True, "email": row[0]}


class AdmitBatchRequest(BaseModel):
    count: int = 10


@router.post("/waitlist/admit-batch")
async def admin_admit_batch(body: AdmitBatchRequest, user: dict = Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE waitlist SET admitted = TRUE, admitted_at = NOW()
               WHERE id IN (
                   SELECT id FROM waitlist WHERE admitted = FALSE ORDER BY created_at LIMIT %s
               )
               RETURNING email""",
            (body.count,),
        )
        rows = cur.fetchall()

    for row in rows:
        await email_svc.send_welcome_email(row[0], "")

    logger.info("Admitted %d from waitlist", len(rows))
    return {"admitted_count": len(rows)}


# ── Generation Log ─────────────────────────────────────────────

@router.get("/generation-log")
async def admin_generation_log(
    user: dict = Depends(require_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    offset = (page - 1) * limit

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT g.id, u.email, g.prompt, g.model, g.gen_type,
                      g.tokens_in, g.tokens_out, g.created_at
               FROM generations g
               JOIN users u ON u.id = g.user_id
               ORDER BY g.created_at DESC
               LIMIT %s OFFSET %s""",
            (limit, offset),
        )
        rows = cur.fetchall()

    return {
        "entries": [
            {
                "id": r[0], "email": r[1],
                "prompt": r[2][:200] if r[2] else "",
                "model": r[3], "gen_type": r[4],
                "tokens_in": r[5], "tokens_out": r[6],
                "created_at": r[7].isoformat(),
            }
            for r in rows
        ]
    }


# ── Activity Log ──────────────────────────────────────────────

@router.get("/activity")
async def admin_activity_log(
    user: dict = Depends(require_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
):
    return get_activity_log(page=page, limit=limit, action=action, entity_type=entity_type)


# ── User Detail & Audit Trail ────────────────────────────────

@router.get("/users/{user_id}")
async def admin_user_detail(user_id: int, user: dict = Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT u.id, u.email, u.display_name, u.created_at,
                      t.id as tier_id, t.name as tier_name, t.slug as tier_slug,
                      u.gens_used_this_month, u.gens_reset_at,
                      u.subscription_status, u.stripe_customer_id,
                      u.is_admin, u.email_verified, u.google_id,
                      (SELECT COUNT(*) FROM sites s WHERE s.user_id = u.id) as site_count,
                      (SELECT COUNT(*) FROM generations g WHERE g.user_id = u.id) as total_gens
               FROM users u
               JOIN tiers t ON t.id = u.tier_id
               WHERE u.id = %s""",
            (user_id,),
        )
        r = cur.fetchone()

    if not r:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": r[0], "email": r[1], "display_name": r[2],
        "created_at": r[3].isoformat(),
        "tier_id": r[4], "tier_name": r[5], "tier_slug": r[6],
        "gens_used": r[7],
        "gens_reset_at": r[8].isoformat() if r[8] else None,
        "subscription_status": r[9], "stripe_customer_id": r[10],
        "is_admin": r[11], "email_verified": r[12],
        "has_google": bool(r[13]),
        "site_count": r[14], "total_gens": r[15],
    }


@router.get("/users/{user_id}/audit")
async def admin_user_audit(
    user_id: int,
    user: dict = Depends(require_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    return get_user_audit_trail(user_id, page=page, limit=limit)


@router.get("/users/{user_id}/sites")
async def admin_user_sites(user_id: int, user: dict = Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, slug, title, created_at, updated_at, slug_type, custom_domain
               FROM sites WHERE user_id = %s ORDER BY updated_at DESC""",
            (user_id,),
        )
        rows = cur.fetchall()

    return {
        "sites": [
            {
                "id": r[0], "slug": r[1], "title": r[2],
                "created_at": r[3].isoformat(),
                "updated_at": r[4].isoformat() if r[4] else None,
                "slug_type": r[5], "custom_domain": r[6],
            }
            for r in rows
        ]
    }


@router.get("/users/{user_id}/generations")
async def admin_user_generations(
    user_id: int,
    user: dict = Depends(require_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
):
    offset = (page - 1) * limit
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, prompt, gen_type, tokens_in, tokens_out, created_at
               FROM generations WHERE user_id = %s
               ORDER BY created_at DESC LIMIT %s OFFSET %s""",
            (user_id, limit, offset),
        )
        rows = cur.fetchall()

    return {
        "generations": [
            {
                "id": r[0], "prompt": r[1][:200] if r[1] else "",
                "gen_type": r[2], "tokens_in": r[3], "tokens_out": r[4],
                "created_at": r[5].isoformat(),
            }
            for r in rows
        ]
    }


class AdminUserUpdate(BaseModel):
    tier_id: Optional[int] = None
    subscription_status: Optional[str] = None
    is_admin: Optional[bool] = None
    gens_used_this_month: Optional[int] = None


@router.patch("/users/{user_id}")
async def admin_update_user(
    user_id: int, body: AdminUserUpdate, user: dict = Depends(require_admin)
):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate tier if changing
    if "tier_id" in data:
        tier = get_tier_by_id(data["tier_id"])
        if not tier:
            raise HTTPException(status_code=404, detail="Tier not found")

    set_parts = [f"{k} = %s" for k in data]
    values = list(data.values()) + [user_id]

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE users SET {', '.join(set_parts)} WHERE id = %s RETURNING email",
            values,
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    log_activity(
        "admin_user_update", user_id=user["id"], user_email=user["email"],
        entity_type="user", entity_id=str(user_id),
        detail={"target_user": user_id, "changes": data},
    )
    logger.info("Admin updated user %s: %s", user_id, list(data.keys()))
    return {"updated": True, "email": row[0], "changes": data}


# ── Activity Log Actions ──────────────────────────────────────

@router.get("/activity/actions")
async def admin_activity_actions(user: dict = Depends(require_admin)):
    """Return distinct action types for filtering."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT action FROM activity_log ORDER BY action")
        rows = cur.fetchall()
    return {"actions": [r[0] for r in rows]}
