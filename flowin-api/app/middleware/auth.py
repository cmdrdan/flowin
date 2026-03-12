import jwt
from fastapi import Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings
from app.db import get_conn

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, display_name, is_admin FROM users WHERE id = %s", (user_id,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="User not found")

    return {"id": row[0], "email": row[1], "display_name": row[2], "is_admin": row[3]}


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_internal_token(
    x_internal_token: str = Header(None),
) -> bool:
    if not settings.internal_token:
        raise HTTPException(status_code=501, detail="Internal token not configured")
    if x_internal_token != settings.internal_token:
        raise HTTPException(status_code=403, detail="Invalid internal token")
    return True
