import logging
import stripe

from app.config import settings
from app.db import get_conn

logger = logging.getLogger(__name__)


def _init_stripe():
    stripe.api_key = settings.stripe_secret_key


def create_checkout_session(user_id: int, user_email: str, tier_slug: str, stripe_price_id: str) -> str:
    """Create a Stripe Checkout session and return the URL."""
    _init_stripe()

    # Get or create Stripe customer
    customer_id = _get_or_create_customer(user_id, user_email)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": stripe_price_id, "quantity": 1}],
        success_url=f"https://editor.flowin.one/dashboard.html?payment=success&tier={tier_slug}",
        cancel_url=f"https://editor.flowin.one/dashboard.html?payment=cancelled",
        metadata={"user_id": str(user_id), "tier_slug": tier_slug},
    )
    return session.url


def create_portal_session(user_id: int) -> str:
    """Create a Stripe Customer Portal session and return the URL."""
    _init_stripe()

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT stripe_customer_id FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()

    if not row or not row[0]:
        raise ValueError("No Stripe customer found for this user")

    session = stripe.billing_portal.Session.create(
        customer=row[0],
        return_url="https://editor.flowin.one/dashboard.html",
    )
    return session.url


def _get_or_create_customer(user_id: int, email: str) -> str:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT stripe_customer_id FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()

    if row and row[0]:
        return row[0]

    _init_stripe()
    customer = stripe.Customer.create(
        email=email,
        metadata={"user_id": str(user_id)},
    )

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET stripe_customer_id = %s WHERE id = %s",
            (customer.id, user_id),
        )

    return customer.id


def handle_checkout_completed(session: dict):
    """Handle checkout.session.completed webhook event."""
    user_id = int(session["metadata"]["user_id"])
    tier_slug = session["metadata"]["tier_slug"]
    customer_id = session.get("customer")

    from app.services.tiers import get_tier_by_slug
    tier = get_tier_by_slug(tier_slug)
    if not tier:
        logger.error("Unknown tier slug from checkout: %s", tier_slug)
        return

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE users
               SET tier_id = %s, stripe_customer_id = %s, subscription_status = 'active'
               WHERE id = %s""",
            (tier["id"], customer_id, user_id),
        )

    logger.info("User %s upgraded to %s via checkout", user_id, tier_slug)


def handle_subscription_updated(subscription: dict):
    """Handle customer.subscription.updated webhook event."""
    customer_id = subscription.get("customer")
    status = subscription.get("status", "active")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET subscription_status = %s WHERE stripe_customer_id = %s",
            (status, customer_id),
        )

    logger.info("Subscription updated for customer %s: %s", customer_id, status)


def handle_subscription_deleted(subscription: dict):
    """Handle customer.subscription.deleted — downgrade to free."""
    customer_id = subscription.get("customer")

    from app.services.tiers import get_tier_by_slug
    free_tier = get_tier_by_slug("free")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE users
               SET tier_id = %s, subscription_status = 'free', tier_expires_at = NOW()
               WHERE stripe_customer_id = %s
               RETURNING email""",
            (free_tier["id"], customer_id),
        )
        row = cur.fetchone()

    if row:
        logger.info("Subscription cancelled for customer %s, downgraded to free", customer_id)


def handle_payment_failed(invoice: dict):
    """Handle invoice.payment_failed — mark as past_due."""
    customer_id = invoice.get("customer")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE users SET subscription_status = 'past_due'
               WHERE stripe_customer_id = %s
               RETURNING id, email""",
            (customer_id,),
        )
        row = cur.fetchone()

    if row:
        logger.warning("Payment failed for user %s (customer %s)", row[0], customer_id)
        return row[1]  # Return email for notification
    return None


def construct_event(payload: bytes, sig_header: str):
    """Verify and construct a Stripe webhook event."""
    _init_stripe()
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
