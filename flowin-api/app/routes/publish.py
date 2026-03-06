import logging
from fastapi import APIRouter, Request, Response, Query, Depends, HTTPException
from typing import Optional

from app.middleware.rate_limit import rate_limit_publish
from app.services.sites import create_site
from app.utils.cloudflare import purge_cache

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/publish")
async def publish(
    request: Request,
    slug: Optional[str] = Query(None),
    user: dict = Depends(rate_limit_publish),
):
    html_bytes = await request.body()
    html = html_bytes.decode("utf-8")

    if not html.strip():
        raise HTTPException(status_code=400, detail="Empty HTML body")

    try:
        site = create_site(
            user_id=user["id"],
            slug=slug,
            title=slug or "Untitled",
            html=html,
        )
    except ValueError as e:
        status = 409 if "taken" in str(e) else 400
        raise HTTPException(status_code=status, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    logger.info("Published site: %s by user %s", site["slug"], user["id"])
    await purge_cache(site["slug"])
    return Response(content=site["url"], media_type="text/plain")
