import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _send_smtp(to: str, subject: str, html_body: str):
    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.email_from_name} <{settings.email_from}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.email_from, to, msg.as_string())


async def _send_sendgrid(to: str, subject: str, html_body: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {settings.sendgrid_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": settings.email_from, "name": settings.email_from_name},
                "subject": subject,
                "content": [{"type": "text/html", "value": html_body}],
            },
        )
        if resp.status_code >= 400:
            logger.error("SendGrid error: %s %s", resp.status_code, resp.text)


async def send_email(to: str, subject: str, html_body: str):
    if not _is_configured():
        logger.warning("Email not configured, skipping send to %s", to)
        return

    try:
        if settings.email_provider == "sendgrid" and settings.sendgrid_api_key:
            await _send_sendgrid(to, subject, html_body)
        elif settings.smtp_host:
            _send_smtp(to, subject, html_body)
        else:
            logger.warning("No email provider configured")
            return
        logger.info("Email sent to %s: %s", to, subject)
    except Exception:
        logger.exception("Failed to send email to %s", to)


def _is_configured() -> bool:
    if settings.email_provider == "sendgrid":
        return bool(settings.sendgrid_api_key)
    return bool(settings.smtp_host and settings.smtp_user)


def _wrap_html(content: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;">
<div style="text-align:center;margin-bottom:24px;">
  <span style="font-size:24px;font-weight:bold;color:#4f46e5;">Flowin</span>
</div>
{content}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
  Flowin &mdash; Build your site in seconds
</div>
</body></html>"""


async def send_verification_email(to: str, token: str):
    link = f"https://api.flowin.one/auth/verify-email?token={token}"
    html = _wrap_html(f"""
<h2 style="color:#4f46e5;">Verify your email</h2>
<p>Welcome to Flowin! Click the button below to verify your email address.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{link}" style="display:inline-block;padding:12px 32px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Verify Email</a>
</div>
<p style="font-size:13px;color:#6b7280;">This link expires in 24 hours. If you didn't create a Flowin account, you can ignore this email.</p>
""")
    await send_email(to, "Verify your Flowin email", html)


async def send_welcome_email(to: str, display_name: str):
    name = display_name or "there"
    html = _wrap_html(f"""
<h2 style="color:#4f46e5;">Welcome to Flowin, {name}!</h2>
<p>Your email is verified and your account is ready. You can now:</p>
<ul>
  <li>Generate sites with AI</li>
  <li>Publish to your own subdomain</li>
  <li>Manage everything from your dashboard</li>
</ul>
<div style="text-align:center;margin:24px 0;">
  <a href="https://editor.flowin.one/" style="display:inline-block;padding:12px 32px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Open Editor</a>
</div>
""")
    await send_email(to, f"Welcome to Flowin, {name}!", html)


async def send_password_reset_email(to: str, token: str):
    link = f"https://editor.flowin.one/reset-password.html?token={token}"
    html = _wrap_html(f"""
<h2 style="color:#4f46e5;">Reset your password</h2>
<p>We received a request to reset your Flowin password. Click the button below to set a new one.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{link}" style="display:inline-block;padding:12px 32px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Reset Password</a>
</div>
<p style="font-size:13px;color:#6b7280;">This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
""")
    await send_email(to, "Reset your Flowin password", html)


async def send_payment_confirmation_email(to: str, tier_name: str, amount: str):
    html = _wrap_html(f"""
<h2 style="color:#4f46e5;">Payment confirmed</h2>
<p>Your upgrade to <strong>{tier_name}</strong> is active! You were charged <strong>{amount}</strong>.</p>
<p>Enjoy your new features. You can manage your subscription from the dashboard.</p>
""")
    await send_email(to, f"Flowin {tier_name} plan activated", html)


async def send_payment_failed_email(to: str):
    html = _wrap_html("""
<h2 style="color:#dc2626;">Payment failed</h2>
<p>We couldn't process your latest payment. Please update your payment method to keep your plan active.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="https://editor.flowin.one/dashboard.html" style="display:inline-block;padding:12px 32px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Update Payment</a>
</div>
""")
    await send_email(to, "Flowin payment failed", html)


async def send_generation_limit_warning(to: str, used: int, limit: int):
    pct = int(used / limit * 100)
    html = _wrap_html(f"""
<h2 style="color:#b45309;">Generation limit warning</h2>
<p>You've used <strong>{used}</strong> of your <strong>{limit}</strong> monthly AI generations ({pct}%).</p>
<p>Consider upgrading your plan for more generations.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="https://editor.flowin.one/dashboard.html" style="display:inline-block;padding:12px 32px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Plans</a>
</div>
""")
    await send_email(to, "Flowin: Generation limit warning", html)
