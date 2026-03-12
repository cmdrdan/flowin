import logging
import hashlib
import secrets
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr

from app.config import settings
from app.db import get_conn
from app.middleware.auth import get_current_user
from app.utils.turnstile import verify_turnstile
from app.services.tiers import get_user_with_tier, get_all_tiers
from app.services import email as email_svc
from app.services.activity import log_activity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth")


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""
    turnstile_token: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, email: str, is_admin: bool = False) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
        "iat": datetime.now(timezone.utc),
    }
    if is_admin:
        payload["role"] = "admin"
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _create_email_token(user_id: int, purpose: str, hours: int = 24) -> str:
    payload = {
        "sub": user_id,
        "purpose": purpose,
        "exp": datetime.now(timezone.utc) + timedelta(hours=hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _get_free_user_count() -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM users u JOIN tiers t ON t.id = u.tier_id WHERE t.slug = 'free'"
        )
        return cur.fetchone()[0]


def _get_free_user_cap() -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT free_user_cap FROM site_settings WHERE id = 1")
        row = cur.fetchone()
        return row[0] if row else 200


@router.post("/signup")
async def signup(req: SignupRequest):
    await verify_turnstile(req.turnstile_token)

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Check free user cap
    free_count = _get_free_user_count()
    cap = _get_free_user_cap()
    if free_count >= cap:
        # Add to waitlist
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM waitlist WHERE email = %s", (req.email,))
            if not cur.fetchone():
                cur.execute("INSERT INTO waitlist (email) VALUES (%s)", (req.email,))
        return {
            "status": "waitlisted",
            "message": "We're at capacity! You've been added to the waitlist and we'll email you when a spot opens up.",
        }

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")

        pw_hash = hash_password(req.password)
        cur.execute(
            """INSERT INTO users (email, password_hash, display_name, tier_id, email_verified)
               VALUES (%s, %s, %s, 1, FALSE) RETURNING id, email, display_name""",
            (req.email, pw_hash, req.display_name),
        )
        row = cur.fetchone()

    # Send verification email
    verification_token = _create_email_token(row[0], "email_verify", hours=24)
    await email_svc.send_verification_email(req.email, verification_token)

    token = create_token(row[0], row[1])
    logger.info("New user signup: %s", req.email)
    log_activity("signup", user_id=row[0], user_email=req.email, entity_type="user", entity_id=str(row[0]))
    return {
        "token": token,
        "user": {"id": row[0], "email": row[1], "display_name": row[2]},
        "email_verification_required": True,
    }


@router.post("/login")
async def login(req: LoginRequest):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, password_hash, display_name, email_verified, is_admin FROM users WHERE email = %s",
            (req.email,),
        )
        row = cur.fetchone()

    if not row or not verify_password(req.password, row[2]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not row[4]:
        # Allow login but flag it
        pass

    token = create_token(row[0], row[1], is_admin=row[5])
    logger.info("User login: %s", req.email)
    log_activity("login", user_id=row[0], user_email=row[1], entity_type="user", entity_id=str(row[0]))
    return {
        "token": token,
        "user": {"id": row[0], "email": row[1], "display_name": row[3]},
        "email_verified": row[4],
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    full_user = get_user_with_tier(user["id"])
    if not full_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": full_user}


@router.get("/verify-email")
async def verify_email(token: str = Query(...)):
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Verification link expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid verification link")

    if payload.get("purpose") != "email_verify":
        raise HTTPException(status_code=400, detail="Invalid token purpose")

    user_id = payload.get("sub")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET email_verified = TRUE WHERE id = %s RETURNING email, display_name",
            (user_id,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    await email_svc.send_welcome_email(row[0], row[1])
    logger.info("Email verified for user %s", user_id)
    log_activity("email_verified", user_id=user_id, user_email=row[0], entity_type="user", entity_id=str(user_id))

    return RedirectResponse(
        url="https://editor.flowin.one/dashboard.html?verified=true",
        status_code=302,
    )


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        row = cur.fetchone()

    # Always return success to prevent email enumeration
    if not row:
        return {"message": "If an account exists with that email, a reset link has been sent."}

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
               VALUES (%s, %s, %s)""",
            (row[0], token_hash, datetime.now(timezone.utc) + timedelta(hours=1)),
        )

    await email_svc.send_password_reset_email(req.email, raw_token)
    logger.info("Password reset requested for %s", req.email)
    return {"message": "If an account exists with that email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    token_hash = hashlib.sha256(req.token.encode()).hexdigest()

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, user_id FROM password_reset_tokens
               WHERE token_hash = %s AND used = FALSE AND expires_at > NOW()""",
            (token_hash,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    pw_hash = hash_password(req.password)

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (pw_hash, row[1]))
        cur.execute("UPDATE password_reset_tokens SET used = TRUE WHERE id = %s", (row[0],))

    logger.info("Password reset for user %s", row[1])
    log_activity("password_reset", user_id=row[1], entity_type="user", entity_id=str(row[1]))
    return {"message": "Password reset successfully. You can now log in."}


# ── Google OAuth ──────────────────────────────────────────────────

@router.get("/google")
async def google_auth_redirect():
    """Redirect user to Google OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"https://accounts.google.com/o/oauth2/v2/auth?{qs}")


@router.get("/google/callback")
async def google_callback(code: str = Query(...)):
    """Handle Google OAuth callback — exchange code for tokens, upsert user."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google auth code")

        tokens = token_resp.json()
        access_token = tokens["access_token"]

        # Get user info
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get Google user info")

        userinfo = userinfo_resp.json()

    google_id = userinfo["id"]
    email = userinfo.get("email", "")
    name = userinfo.get("name", "")

    # Upsert user
    with get_conn() as conn:
        cur = conn.cursor()
        # Check if user exists by google_id
        cur.execute("SELECT id, email, is_admin FROM users WHERE google_id = %s", (google_id,))
        row = cur.fetchone()

        if row:
            user_id, user_email, is_admin = row
        else:
            # Check by email
            cur.execute("SELECT id, email, is_admin FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
            if row:
                # Link Google account to existing user
                cur.execute("UPDATE users SET google_id = %s, email_verified = TRUE WHERE id = %s", (google_id, row[0]))
                user_id, user_email, is_admin = row
            else:
                # Check free user cap
                free_count = _get_free_user_count()
                cap = _get_free_user_cap()
                if free_count >= cap:
                    return RedirectResponse(
                        url="https://editor.flowin.one/?waitlisted=true",
                        status_code=302,
                    )

                # New user
                cur.execute(
                    """INSERT INTO users (email, password_hash, display_name, google_id, email_verified, tier_id)
                       VALUES (%s, %s, %s, %s, TRUE, 1) RETURNING id""",
                    (email, "", name, google_id),
                )
                user_id = cur.fetchone()[0]
                user_email = email
                is_admin = False

    token = create_token(user_id, user_email, is_admin=is_admin)
    logger.info("Google OAuth login: %s", user_email)
    log_activity("oauth_login", user_id=user_id, user_email=user_email, entity_type="user", entity_id=str(user_id), detail={"provider": "google"})

    # Redirect to editor with token in fragment (client-side picks it up)
    return RedirectResponse(
        url=f"https://editor.flowin.one/dashboard.html?google_token={token}",
        status_code=302,
    )


@router.get("/tiers")
async def list_tiers():
    """Public endpoint to list available tiers for pricing page."""
    tiers = get_all_tiers(active_only=True)
    return {"tiers": tiers}
