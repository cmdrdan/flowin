import os
import re
import sys
import random
from typing import Optional, List

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from supabase import create_client

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SITES_DIR = "/var/www/flowin-sites"
BASE_DOMAIN = "flowin.one"
MAX_SITE_SIZE = 2 * 1024 * 1024  # 2 MB

_openai_key = os.environ.get("OPENAI_API_KEY")
if not _openai_key:
    print("ERROR: OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
    sys.exit(1)

openai_client = OpenAI(api_key=_openai_key)

_supabase_url = os.environ.get("SUPABASE_URL", "")
_supabase_service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
supabase_client = None
if _supabase_url and _supabase_service_key:
    supabase_client = create_client(_supabase_url, _supabase_service_key)

_stripe_secret = os.environ.get("STRIPE_SECRET_KEY", "")
stripe = None
if _stripe_secret:
    import stripe as _stripe_mod
    _stripe_mod.api_key = _stripe_secret
    stripe = _stripe_mod

# Stripe price IDs (set in .env or environment)
STRIPE_PRICES = {
    "starter_monthly": os.environ.get("STRIPE_PRICE_STARTER_MONTHLY", ""),
    "starter_yearly": os.environ.get("STRIPE_PRICE_STARTER_YEARLY", ""),
    "pro_monthly": os.environ.get("STRIPE_PRICE_PRO_MONTHLY", ""),
    "pro_yearly": os.environ.get("STRIPE_PRICE_PRO_YEARLY", ""),
}

# ---------------------------------------------------------------------------
# App & middleware
# ---------------------------------------------------------------------------
app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return Response("Too many requests. Please wait a moment and try again.", status_code=429)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://editor.flowin.one",
        "https://flowin.one",
        "http://localhost:3000",
        "http://localhost:8080",
    ],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Slug generation
# ---------------------------------------------------------------------------
ADJECTIVES = [
    "amused", "brave", "calm", "cheerful", "chilly", "clever", "cloudy",
    "cozy", "cranky", "curious", "daring", "eager", "fancy", "fuzzy",
    "gentle", "glossy", "grumpy", "happy", "hollow", "jolly", "kind",
    "lazy", "lofty", "lucky", "messy", "mighty", "nifty", "nimble",
    "odd", "peppy", "perky", "picky", "plucky", "poofy", "quick",
    "quiet", "quirky", "risky", "shiny", "shy", "silly", "sleepy",
    "slim", "slow", "smug", "snappy", "snug", "soft", "spicy",
    "stealthy", "stormy", "strange", "sunny", "swift", "tame",
    "thirsty", "tidy", "tiny", "twisty", "vivid", "wacky", "warm",
    "weird", "wild", "witty", "zany", "zesty", "zippy", "bold",
    "bubbly", "feisty", "jazzy", "loopy", "noisy", "sassy",
    "squeaky", "wavy", "whimsical",
]

NOUNS = [
    "acorn", "alpaca", "apple", "avocado", "bagel", "balloon", "banana",
    "bison", "blossom", "bubble", "cactus", "carrot", "cat", "cloud",
    "cookie", "crayon", "cupcake", "dolphin", "donut", "dragon", "duck",
    "eagle", "eggplant", "feather", "flamingo", "flower", "fox",
    "giraffe", "grape", "hamster", "hedgehog", "hippo", "honeybee",
    "iceberg", "iguana", "jellybean", "kangaroo", "koala", "lemon",
    "lion", "llama", "mango", "monkey", "moon", "mushroom", "narwhal",
    "noodle", "octopus", "otter", "owl", "panda", "peach", "peanut",
    "penguin", "pickle", "pineapple", "popsicle", "potato", "puppy",
    "quokka", "rabbit", "rainbow", "raspberry", "robot", "rocket",
    "scooter", "shark", "sloth", "snail", "snowman", "squid",
    "starfish", "sunflower", "taco", "teacup", "tiger", "tomato",
    "tornado", "turtle", "unicorn", "waffle", "walrus", "whale", "yak",
    "zebra",
]


def generate_slug() -> str:
    base = f"{random.choice(ADJECTIVES)}-{random.choice(NOUNS)}"
    suffix = str(random.randint(1, 99))
    return f"{base}-{suffix}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def extract_html_from_response(text: str) -> str:
    match = re.search(r"```(?:html)?\s*(.*?)```", text, re.DOTALL)
    return match.group(1).strip() if match else text


def _extract_user_id(request: Request) -> Optional[str]:
    """Extract user ID from Supabase JWT (Authorization: Bearer <token>)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        import jwt
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("sub")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class PromptInput(BaseModel):
    prompt: str


class ProvisionInput(BaseModel):
    slug: str
    title: str
    purpose: str
    features: List[str]
    color_scheme: str


class CheckoutInput(BaseModel):
    tier: str  # 'starter' or 'pro'
    billing: str = "monthly"  # 'monthly' or 'yearly'
    user_email: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.post("/publish")
@limiter.limit("10/minute")
async def publish(request: Request, slug: Optional[str] = Query(None)):
    html = await request.body()

    if len(html) > MAX_SITE_SIZE:
        return Response("Site content exceeds the 2 MB limit.", status_code=413)

    if not html.strip():
        return Response("Cannot publish an empty site.", status_code=400)

    if slug:
        slug = slug.lower()
        if not all(c.isalnum() or c == '-' for c in slug):
            return Response("Invalid slug format", status_code=400)
        site_path = os.path.join(SITES_DIR, slug)
        if os.path.exists(site_path):
            # Allow re-publishing to the same slug (update existing site)
            pass
        else:
            os.makedirs(site_path, exist_ok=True)
    else:
        for _ in range(10):
            slug = generate_slug()
            site_path = os.path.join(SITES_DIR, slug)
            if not os.path.exists(site_path):
                break
        else:
            return Response("Could not generate unique slug", status_code=500)
        os.makedirs(site_path, exist_ok=True)

    site_path = os.path.join(SITES_DIR, slug)
    with open(os.path.join(site_path, "index.html"), "wb") as f:
        f.write(html)

    return Response(content=f"https://{slug}.{BASE_DOMAIN}", media_type="text/plain")


@app.post("/generate")
@limiter.limit("5/minute")
async def generate_html(request: Request, body: PromptInput):
    system_msg = (
        "You are an expert web developer who creates beautiful, modern, "
        "mobile-friendly websites. Return a complete HTML5 page inside a "
        "single Markdown code block. Use clean semantic HTML, embedded CSS, "
        "and minimal inline JavaScript. The site must look polished and "
        "professional on both phones and desktops."
    )

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": body.prompt},
            ],
            temperature=0.7,
        )
        msg = response.choices[0].message.content
        html = extract_html_from_response(msg)
        return {"html": html}
    except Exception as e:
        return Response(content=str(e), status_code=502, media_type="text/plain")


@app.post("/provision")
@limiter.limit("5/minute")
async def provision_site(request: Request, body: ProvisionInput):
    if not supabase_client:
        return Response("Database not configured.", status_code=503)

    user_id = _extract_user_id(request)

    row = {
        "site_slug": body.slug,
        "title": body.title,
        "purpose": body.purpose,
        "features": body.features,
        "color_scheme": body.color_scheme,
    }
    if user_id:
        row["owner_id"] = user_id

    try:
        result = supabase_client.table("sites").insert(row).execute()
        if result.data and len(result.data) > 0:
            site_id = result.data[0]["id"]
            return {"site_id": site_id, "slug": body.slug}
        return Response("Failed to provision site.", status_code=500)
    except Exception as e:
        return Response(content=str(e), status_code=500, media_type="text/plain")


@app.post("/create-checkout-session")
@limiter.limit("5/minute")
async def create_checkout(request: Request, body: CheckoutInput):
    if not stripe:
        return Response("Payments not configured.", status_code=503)

    price_key = f"{body.tier}_{body.billing}"
    price_id = STRIPE_PRICES.get(price_key)
    if not price_id:
        return Response(f"Unknown plan: {body.tier}/{body.billing}", status_code=400)

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url="https://editor.flowin.one?payment=success",
            cancel_url="https://editor.flowin.one?payment=cancelled",
            customer_email=body.user_email,
        )
        return {"checkout_url": session.url}
    except Exception as e:
        return Response(content=str(e), status_code=502, media_type="text/plain")


@app.get("/health")
async def health():
    return {"status": "ok"}
