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

    class Config:
        env_file = ".env"


settings = Settings()
