import time
from collections import defaultdict
from fastapi import HTTPException, Depends

from app.middleware.auth import get_current_user

# In-memory rate limiter (per-process). For multi-process, use Redis.
_buckets: dict[str, list[float]] = defaultdict(list)


def _check_rate(key: str, max_requests: int, window_seconds: int):
    now = time.time()
    cutoff = now - window_seconds
    _buckets[key] = [t for t in _buckets[key] if t > cutoff]
    if len(_buckets[key]) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {max_requests} requests per {window_seconds // 3600}h.",
        )
    _buckets[key].append(now)


async def rate_limit_generate(user: dict = Depends(get_current_user)):
    _check_rate(f"generate:{user['id']}", max_requests=10, window_seconds=3600)
    return user


async def rate_limit_publish(user: dict = Depends(get_current_user)):
    _check_rate(f"publish:{user['id']}", max_requests=50, window_seconds=86400)
    return user
