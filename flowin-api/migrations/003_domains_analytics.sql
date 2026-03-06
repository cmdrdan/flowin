CREATE TABLE IF NOT EXISTS custom_domains (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    domain TEXT UNIQUE NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_site_id ON custom_domains(site_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);

CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    path TEXT NOT NULL DEFAULT '/',
    referrer TEXT,
    user_agent TEXT,
    country TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_site_id ON page_views(site_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
