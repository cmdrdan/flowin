import httpx
from fastapi import HTTPException

from app.config import settings

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str | None):
    if not settings.turnstile_secret:
        return  # Skip if not configured

    if not token:
        raise HTTPException(status_code=400, detail="Captcha token required")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            VERIFY_URL,
            data={"secret": settings.turnstile_secret, "response": token},
        )
        result = resp.json()

    if not result.get("success"):
        raise HTTPException(status_code=403, detail="Captcha verification failed")
