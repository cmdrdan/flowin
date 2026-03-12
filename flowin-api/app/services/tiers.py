import logging
from app.db import get_conn

logger = logging.getLogger(__name__)


def get_all_tiers(active_only: bool = True) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        sql = "SELECT id, name, slug, price_monthly, max_sites, max_gens_month, allows_custom_subdomain, allows_custom_domain, allows_db_apps, show_ads, features_list, is_active, display_order, stripe_price_id FROM tiers"
        if active_only:
            sql += " WHERE is_active = TRUE"
        sql += " ORDER BY display_order"
        cur.execute(sql)
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "name": r[1], "slug": r[2],
            "price_monthly": float(r[3]), "max_sites": r[4],
            "max_gens_month": r[5], "allows_custom_subdomain": r[6],
            "allows_custom_domain": r[7], "allows_db_apps": r[8],
            "show_ads": r[9], "features_list": r[10],
            "is_active": r[11], "display_order": r[12],
            "stripe_price_id": r[13],
        }
        for r in rows
    ]


def get_tier_by_id(tier_id: int) -> dict | None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, slug, price_monthly, max_sites, max_gens_month, allows_custom_subdomain, allows_custom_domain, allows_db_apps, show_ads, features_list, stripe_price_id FROM tiers WHERE id = %s",
            (tier_id,),
        )
        r = cur.fetchone()

    if not r:
        return None

    return {
        "id": r[0], "name": r[1], "slug": r[2],
        "price_monthly": float(r[3]), "max_sites": r[4],
        "max_gens_month": r[5], "allows_custom_subdomain": r[6],
        "allows_custom_domain": r[7], "allows_db_apps": r[8],
        "show_ads": r[9], "features_list": r[10],
        "stripe_price_id": r[11],
    }


def get_tier_by_slug(slug: str) -> dict | None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, slug, price_monthly, max_sites, max_gens_month, allows_custom_subdomain, allows_custom_domain, allows_db_apps, show_ads, features_list, stripe_price_id FROM tiers WHERE slug = %s",
            (slug,),
        )
        r = cur.fetchone()

    if not r:
        return None

    return {
        "id": r[0], "name": r[1], "slug": r[2],
        "price_monthly": float(r[3]), "max_sites": r[4],
        "max_gens_month": r[5], "allows_custom_subdomain": r[6],
        "allows_custom_domain": r[7], "allows_db_apps": r[8],
        "show_ads": r[9], "features_list": r[10],
        "stripe_price_id": r[11],
    }


def get_tier_for_user(user_id: int) -> dict:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT t.id, t.name, t.slug, t.price_monthly, t.max_sites, t.max_gens_month,
                      t.allows_custom_subdomain, t.allows_custom_domain, t.allows_db_apps,
                      t.show_ads, t.features_list, t.stripe_price_id
               FROM tiers t
               JOIN users u ON u.tier_id = t.id
               WHERE u.id = %s""",
            (user_id,),
        )
        r = cur.fetchone()

    if not r:
        return get_tier_by_slug("free")

    return {
        "id": r[0], "name": r[1], "slug": r[2],
        "price_monthly": float(r[3]), "max_sites": r[4],
        "max_gens_month": r[5], "allows_custom_subdomain": r[6],
        "allows_custom_domain": r[7], "allows_db_apps": r[8],
        "show_ads": r[9], "features_list": r[10],
        "stripe_price_id": r[11],
    }


def update_tier(tier_id: int, data: dict) -> dict | None:
    allowed_fields = {
        "name", "price_monthly", "max_sites", "max_gens_month",
        "allows_custom_subdomain", "allows_custom_domain", "allows_db_apps",
        "show_ads", "features_list", "is_active", "display_order", "stripe_price_id",
    }
    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        return get_tier_by_id(tier_id)

    set_parts = [f"{k} = %s" for k in updates]
    values = list(updates.values()) + [tier_id]

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE tiers SET {', '.join(set_parts)} WHERE id = %s RETURNING id",
            values,
        )
        if not cur.fetchone():
            return None

    return get_tier_by_id(tier_id)


def get_user_with_tier(user_id: int) -> dict | None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT u.id, u.email, u.display_name, u.tier_id, u.stripe_customer_id,
                      u.subscription_status, u.gens_used_this_month, u.gens_reset_at,
                      u.is_admin, u.email_verified,
                      t.name as tier_name, t.slug as tier_slug, t.max_sites,
                      t.max_gens_month, t.allows_custom_subdomain, t.allows_custom_domain,
                      t.allows_db_apps, t.show_ads, t.price_monthly
               FROM users u
               JOIN tiers t ON t.id = u.tier_id
               WHERE u.id = %s""",
            (user_id,),
        )
        r = cur.fetchone()

    if not r:
        return None

    return {
        "id": r[0], "email": r[1], "display_name": r[2],
        "tier_id": r[3], "stripe_customer_id": r[4],
        "subscription_status": r[5], "gens_used_this_month": r[6],
        "gens_reset_at": r[7].isoformat() if r[7] else None,
        "is_admin": r[8], "email_verified": r[9],
        "tier": {
            "name": r[10], "slug": r[11], "max_sites": r[12],
            "max_gens_month": r[13], "allows_custom_subdomain": r[14],
            "allows_custom_domain": r[15], "allows_db_apps": r[16],
            "show_ads": r[17], "price_monthly": float(r[18]),
        },
    }


def get_user_site_count(user_id: int) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM sites WHERE user_id = %s", (user_id,))
        return cur.fetchone()[0]


def check_generation_allowed(user_id: int, is_new_site: bool = False, requires_db: bool = False) -> tuple[bool, str | None, str | None, str | None]:
    """Returns (allowed, error_code, message, upgrade_prompt)."""
    user = get_user_with_tier(user_id)
    if not user:
        return False, "user_not_found", "User not found.", None

    tier = user["tier"]

    if user["gens_used_this_month"] >= tier["max_gens_month"]:
        return (
            False,
            "monthly_limit_reached",
            f"You've used all {tier['max_gens_month']} free generations this month.",
            f"Upgrade to Starter for {get_tier_by_slug('starter')['max_gens_month']} generations/month." if tier["slug"] == "free" else "Upgrade your plan for more generations.",
        )

    if is_new_site:
        site_count = get_user_site_count(user_id)
        if site_count >= tier["max_sites"]:
            return (
                False,
                "site_limit_reached",
                f"You've reached the {tier['max_sites']}-site limit on the {tier['name']} plan.",
                "Upgrade for more active sites.",
            )

    if requires_db and not tier["allows_db_apps"]:
        return (
            False,
            "tier_restriction_db",
            "DB-backed apps require the Pro plan.",
            "Upgrade to Pro for database-powered apps.",
        )

    return True, None, None, None


def increment_generation_count(user_id: int):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET gens_used_this_month = gens_used_this_month + 1 WHERE id = %s",
            (user_id,),
        )
