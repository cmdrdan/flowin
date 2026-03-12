import logging
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.services.tiers import get_tier_by_slug
from app.services import stripe_svc
from app.services import email as email_svc
from app.services.activity import log_activity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments")


class CheckoutRequest(BaseModel):
    tier_slug: str


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, user: dict = Depends(get_current_user)):
    tier = get_tier_by_slug(req.tier_slug)
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    if not tier["stripe_price_id"]:
        raise HTTPException(status_code=400, detail="Tier not available for purchase")
    if tier["price_monthly"] == 0:
        raise HTTPException(status_code=400, detail="Cannot checkout for free tier")

    try:
        url = stripe_svc.create_checkout_session(
            user_id=user["id"],
            user_email=user["email"],
            tier_slug=req.tier_slug,
            stripe_price_id=tier["stripe_price_id"],
        )
    except Exception as e:
        logger.error("Stripe checkout creation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

    return {"checkout_url": url}


@router.post("/portal")
async def create_portal(user: dict = Depends(get_current_user)):
    try:
        url = stripe_svc.create_portal_session(user["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Stripe portal creation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create portal session")

    return {"portal_url": url}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe_svc.construct_event(payload, sig_header)
    except Exception as e:
        logger.error("Stripe webhook verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        stripe_svc.handle_checkout_completed(data)
        email = data.get("customer_email") or data.get("customer_details", {}).get("email")
        tier_slug = data.get("metadata", {}).get("tier_slug", "")
        user_id_str = data.get("metadata", {}).get("user_id", "")
        tier = get_tier_by_slug(tier_slug)
        if email and tier:
            await email_svc.send_payment_confirmation_email(
                email, tier["name"], f"${tier['price_monthly']}/mo"
            )
        log_activity("subscription_created", user_id=int(user_id_str) if user_id_str else None, user_email=email or "", entity_type="payment", detail={"tier": tier_slug})

    elif event_type == "customer.subscription.updated":
        stripe_svc.handle_subscription_updated(data)
        log_activity("subscription_updated", entity_type="payment", detail={"customer": data.get("customer"), "status": data.get("status")})

    elif event_type == "customer.subscription.deleted":
        stripe_svc.handle_subscription_deleted(data)
        log_activity("subscription_cancelled", entity_type="payment", detail={"customer": data.get("customer")})

    elif event_type == "invoice.payment_failed":
        email = stripe_svc.handle_payment_failed(data)
        if email:
            await email_svc.send_payment_failed_email(email)
        log_activity("payment_failed", entity_type="payment", detail={"customer": data.get("customer")})

    else:
        logger.debug("Unhandled Stripe event: %s", event_type)

    return {"received": True}
