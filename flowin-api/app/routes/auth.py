import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from app.config import settings
from app.db import get_conn
from app.middleware.auth import get_current_user
from app.utils.turnstile import verify_turnstile

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


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@router.post("/signup")
async def signup(req: SignupRequest):
    await verify_turnstile(req.turnstile_token)

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")

        pw_hash = hash_password(req.password)
        cur.execute(
            """INSERT INTO users (email, password_hash, display_name)
               VALUES (%s, %s, %s) RETURNING id, email, display_name""",
            (req.email, pw_hash, req.display_name),
        )
        row = cur.fetchone()

    token = create_token(row[0], row[1])
    logger.info("New user signup: %s", req.email)
    return {
        "token": token,
        "user": {"id": row[0], "email": row[1], "display_name": row[2]},
    }


@router.post("/login")
async def login(req: LoginRequest):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, password_hash, display_name FROM users WHERE email = %s",
            (req.email,),
        )
        row = cur.fetchone()

    if not row or not verify_password(req.password, row[2]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(row[0], row[1])
    logger.info("User login: %s", req.email)
    return {
        "token": token,
        "user": {"id": row[0], "email": row[1], "display_name": row[3]},
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user}
