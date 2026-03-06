import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.middleware.auth import get_current_user
from app.db import get_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sites/{slug}/credentials")


class CredentialCreate(BaseModel):
    label: str = "Admin"
    username: str
    password: str


class CredentialUpdate(BaseModel):
    label: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


def _verify_site_ownership(slug: str, user_id: int) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM sites WHERE slug = %s AND user_id = %s",
            (slug, user_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Site not found")
    return row[0]


@router.get("")
async def list_credentials(slug: str, user: dict = Depends(get_current_user)):
    site_id = _verify_site_ownership(slug, user["id"])
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, label, username, password, created_at, updated_at
               FROM site_credentials WHERE site_id = %s ORDER BY created_at""",
            (site_id,),
        )
        rows = cur.fetchall()

    return {
        "credentials": [
            {
                "id": r[0],
                "label": r[1],
                "username": r[2],
                "password": r[3],
                "created_at": r[4].isoformat(),
                "updated_at": r[5].isoformat(),
            }
            for r in rows
        ]
    }


@router.post("")
async def create_credential(
    slug: str, body: CredentialCreate, user: dict = Depends(get_current_user)
):
    site_id = _verify_site_ownership(slug, user["id"])
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO site_credentials (site_id, label, username, password)
               VALUES (%s, %s, %s, %s)
               RETURNING id, label, username, password, created_at, updated_at""",
            (site_id, body.label, body.username, body.password),
        )
        r = cur.fetchone()

    logger.info("Created credentials for site %s", slug)
    return {
        "id": r[0],
        "label": r[1],
        "username": r[2],
        "password": r[3],
        "created_at": r[4].isoformat(),
        "updated_at": r[5].isoformat(),
    }


@router.put("/{cred_id}")
async def update_credential(
    slug: str,
    cred_id: int,
    body: CredentialUpdate,
    user: dict = Depends(get_current_user),
):
    site_id = _verify_site_ownership(slug, user["id"])
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, label, username, password FROM site_credentials WHERE id = %s AND site_id = %s",
            (cred_id, site_id),
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Credential not found")

        new_label = body.label if body.label is not None else existing[1]
        new_username = body.username if body.username is not None else existing[2]
        new_password = body.password if body.password is not None else existing[3]

        cur.execute(
            """UPDATE site_credentials
               SET label = %s, username = %s, password = %s, updated_at = NOW()
               WHERE id = %s AND site_id = %s
               RETURNING id, label, username, password, created_at, updated_at""",
            (new_label, new_username, new_password, cred_id, site_id),
        )
        r = cur.fetchone()

    logger.info("Updated credential %s for site %s", cred_id, slug)
    return {
        "id": r[0],
        "label": r[1],
        "username": r[2],
        "password": r[3],
        "created_at": r[4].isoformat(),
        "updated_at": r[5].isoformat(),
    }


@router.delete("/{cred_id}")
async def delete_credential(
    slug: str, cred_id: int, user: dict = Depends(get_current_user)
):
    site_id = _verify_site_ownership(slug, user["id"])
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM site_credentials WHERE id = %s AND site_id = %s RETURNING id",
            (cred_id, site_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Credential not found")

    logger.info("Deleted credential %s for site %s", cred_id, slug)
    return {"deleted": True}
