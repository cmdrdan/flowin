import os
import shutil
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.middleware.auth import get_current_user
from app.services.sites import (
    get_sites_by_user,
    get_site,
    update_site,
    delete_site,
    check_slug_available,
    write_to_filesystem,
)
from app.services.tiers import get_tier_for_user, get_user_with_tier, get_user_site_count
from app.utils.cloudflare import purge_cache
from app.db import get_conn
from app.services.activity import log_activity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sites")


class SiteUpdate(BaseModel):
    title: Optional[str] = None
    html_content: Optional[str] = None


class SlugChange(BaseModel):
    new_slug: Optional[str] = None
    custom_domain: Optional[str] = None
    slug_type: Optional[str] = None  # 'custom_sub' or 'custom_domain'


@router.get("")
async def list_sites(user: dict = Depends(get_current_user)):
    return {"sites": get_sites_by_user(user["id"])}


@router.get("/check-slug/{slug}")
async def check_slug(slug: str):
    return {"available": check_slug_available(slug)}


@router.get("/{slug}")
async def get_site_detail(slug: str, user: dict = Depends(get_current_user)):
    site = get_site(slug, user["id"])
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.put("/{slug}")
async def update_site_endpoint(
    slug: str,
    body: SiteUpdate,
    user: dict = Depends(get_current_user),
):
    site = update_site(slug, user["id"], body.title, body.html_content)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    logger.info("Updated site %s by user %s", slug, user["id"])
    log_activity("site_update", user_id=user["id"], user_email=user["email"], entity_type="site", entity_id=slug)
    await purge_cache(slug)
    return site


@router.delete("/{slug}")
async def delete_site_endpoint(slug: str, user: dict = Depends(get_current_user)):
    if not delete_site(slug, user["id"]):
        raise HTTPException(status_code=404, detail="Site not found")
    logger.info("Deleted site %s by user %s", slug, user["id"])
    log_activity("site_delete", user_id=user["id"], user_email=user["email"], entity_type="site", entity_id=slug)
    await purge_cache(slug)
    return {"deleted": True}


@router.patch("/{slug}/slug")
async def change_slug(slug: str, body: SlugChange, user: dict = Depends(get_current_user)):
    """Change a site's slug (custom subdomain) or attach a custom domain."""
    tier = get_tier_for_user(user["id"])

    # Verify ownership
    site = get_site(slug, user["id"])
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    if body.slug_type == "custom_domain" or body.custom_domain:
        if not tier.get("allows_custom_domain"):
            raise HTTPException(status_code=403, detail="Custom domains require the Pro plan")
        if not body.custom_domain:
            raise HTTPException(status_code=400, detail="custom_domain is required")

        domain = body.custom_domain.lower().strip()
        if not domain or "." not in domain:
            raise HTTPException(status_code=400, detail="Invalid domain format")

        # Store domain info — Cloudflare custom hostname provisioning
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """UPDATE sites
                   SET custom_domain = %s, slug_type = 'custom_domain', domain_verified = FALSE
                   WHERE slug = %s AND user_id = %s""",
                (domain, slug, user["id"]),
            )

        # Initiate Cloudflare custom hostname (if configured)
        hostname_id = await _create_cf_custom_hostname(domain)
        if hostname_id:
            with get_conn() as conn:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE sites SET domain_cf_hostname_id = %s WHERE slug = %s",
                    (hostname_id, slug),
                )

        logger.info("Custom domain %s attached to site %s", domain, slug)
        return {"slug": slug, "custom_domain": domain, "domain_verified": False}

    # Custom subdomain
    if not body.new_slug:
        raise HTTPException(status_code=400, detail="new_slug is required")

    if not tier.get("allows_custom_subdomain"):
        raise HTTPException(status_code=403, detail="Custom subdomains require the Starter plan or above")

    new_slug = body.new_slug.lower().strip()
    if not all(c.isalnum() or c == "-" for c in new_slug):
        raise HTTPException(status_code=400, detail="Slug can only contain letters, numbers, and hyphens")
    if len(new_slug) < 3 or len(new_slug) > 30:
        raise HTTPException(status_code=400, detail="Slug must be 3-30 characters")
    if not check_slug_available(new_slug):
        raise HTTPException(status_code=409, detail="Slug already taken")

    old_path = os.path.join(settings.sites_dir, slug)
    new_path = os.path.join(settings.sites_dir, new_slug)

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE sites SET slug = %s, slug_type = 'custom_sub'
               WHERE slug = %s AND user_id = %s RETURNING id""",
            (new_slug, slug, user["id"]),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Site not found")

    # Move filesystem directory
    if os.path.exists(old_path):
        shutil.move(old_path, new_path)
    else:
        # Re-write from DB content
        write_to_filesystem(new_slug, site.get("html_content", ""))

    # Purge both old and new
    await purge_cache(slug)
    await purge_cache(new_slug)

    logger.info("Slug changed: %s -> %s by user %s", slug, new_slug, user["id"])
    log_activity("slug_change", user_id=user["id"], user_email=user["email"], entity_type="site", entity_id=new_slug, detail={"old_slug": slug})
    return {
        "old_slug": slug,
        "new_slug": new_slug,
        "url": f"https://{new_slug}.{settings.base_domain}",
    }


@router.get("/{slug}/domain-status")
async def domain_status(slug: str, user: dict = Depends(get_current_user)):
    """Poll Cloudflare custom hostname status."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT custom_domain, domain_verified, domain_cf_hostname_id
               FROM sites WHERE slug = %s AND user_id = %s""",
            (slug, user["id"]),
        )
        row = cur.fetchone()

    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="No custom domain configured")

    domain, verified, hostname_id = row

    # Check Cloudflare if we have a hostname ID and not yet verified
    if hostname_id and not verified:
        cf_status = await _check_cf_hostname_status(hostname_id)
        if cf_status == "active":
            with get_conn() as conn:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE sites SET domain_verified = TRUE WHERE slug = %s",
                    (slug,),
                )
            verified = True

        return {"domain": domain, "verified": verified, "cf_status": cf_status}

    return {"domain": domain, "verified": verified, "cf_status": "active" if verified else "pending"}


async def _create_cf_custom_hostname(domain: str) -> str | None:
    """Create a Cloudflare custom hostname for SSL provisioning."""
    if not settings.cloudflare_zone_id or not settings.cloudflare_api_token:
        return None

    import httpx
    url = f"https://api.cloudflare.com/client/v4/zones/{settings.cloudflare_zone_id}/custom_hostnames"
    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json={
                "hostname": domain,
                "ssl": {"method": "http", "type": "dv", "wildcard": False},
            })
            data = resp.json()
            if data.get("success"):
                return data["result"]["id"]
            else:
                logger.warning("CF custom hostname creation failed: %s", data.get("errors"))
    except Exception:
        logger.exception("CF custom hostname error for %s", domain)
    return None


async def _check_cf_hostname_status(hostname_id: str) -> str:
    """Check Cloudflare custom hostname verification status."""
    if not settings.cloudflare_zone_id or not settings.cloudflare_api_token:
        return "unknown"

    import httpx
    url = f"https://api.cloudflare.com/client/v4/zones/{settings.cloudflare_zone_id}/custom_hostnames/{hostname_id}"
    headers = {"Authorization": f"Bearer {settings.cloudflare_api_token}"}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers)
            data = resp.json()
            if data.get("success"):
                return data["result"].get("status", "pending")
    except Exception:
        logger.exception("CF hostname status check error")
    return "unknown"
