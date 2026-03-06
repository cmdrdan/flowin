import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.middleware.auth import get_current_user
from app.services.sites import (
    get_sites_by_user,
    get_site,
    update_site,
    delete_site,
    check_slug_available,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sites")


class SiteUpdate(BaseModel):
    title: Optional[str] = None
    html_content: Optional[str] = None


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
    return site


@router.delete("/{slug}")
async def delete_site_endpoint(slug: str, user: dict = Depends(get_current_user)):
    if not delete_site(slug, user["id"]):
        raise HTTPException(status_code=404, detail="Site not found")
    logger.info("Deleted site %s by user %s", slug, user["id"])
    return {"deleted": True}
