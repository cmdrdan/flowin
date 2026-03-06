import logging
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def purge_cache(slug: str):
    """Purge Cloudflare cache for a specific subdomain."""
    if not settings.cloudflare_zone_id or not settings.cloudflare_api_token:
        logger.debug("Cloudflare not configured, skipping cache purge")
        return

    url = f"https://api.cloudflare.com/client/v4/zones/{settings.cloudflare_zone_id}/purge_cache"
    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }
    # Purge both root and common paths for the subdomain
    subdomain_url = f"https://{slug}.{settings.base_domain}"
    files = [
        subdomain_url,
        f"{subdomain_url}/",
        f"{subdomain_url}/index.html",
    ]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json={"files": files})
            data = resp.json()
            if data.get("success"):
                logger.info("Purged Cloudflare cache for %s", slug)
            else:
                logger.warning("Cloudflare purge failed for %s: %s", slug, data.get("errors"))
    except Exception:
        logger.exception("Cloudflare cache purge error for %s", slug)
