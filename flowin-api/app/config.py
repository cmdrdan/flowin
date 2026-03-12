import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str = "postgresql://flowin:flowin@db:5432/flowin"
    sites_dir: str = "/var/www/flowin-sites"
    base_domain: str = "flowin.one"
    cors_origins: str = "https://editor.flowin.one"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 72
    turnstile_secret: str = ""
    cloudflare_zone_id: str = ""
    cloudflare_api_token: str = ""
    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    # Email (SendGrid or SMTP)
    email_provider: str = "smtp"  # "smtp" or "sendgrid"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    sendgrid_api_key: str = ""
    email_from: str = "noreply@flowin.one"
    email_from_name: str = "Flowin"
    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "https://editor.flowin.one/auth/google/callback"
    # Internal
    internal_token: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
