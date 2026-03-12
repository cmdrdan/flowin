-- Tiers table
CREATE TABLE IF NOT EXISTS tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    price_monthly NUMERIC(8,2) DEFAULT 0,
    stripe_price_id VARCHAR(100),
    max_sites INTEGER NOT NULL,
    max_gens_month INTEGER NOT NULL,
    allows_custom_subdomain BOOLEAN DEFAULT FALSE,
    allows_custom_domain BOOLEAN DEFAULT FALSE,
    allows_db_apps BOOLEAN DEFAULT FALSE,
    show_ads BOOLEAN DEFAULT TRUE,
    features_list JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0
);

INSERT INTO tiers (name, slug, price_monthly, max_sites, max_gens_month,
    allows_custom_subdomain, allows_custom_domain, allows_db_apps, show_ads,
    features_list, display_order)
VALUES
    ('Free', 'free', 0, 1, 3, FALSE, FALSE, FALSE, TRUE,
     '["3 AI generations/month","Random flowin.one subdomain","1 active site","Community support"]', 1),
    ('Starter', 'starter', 8, 3, 15, TRUE, FALSE, FALSE, FALSE,
     '["15 AI generations/month","Custom subdomain (yourname.flowin.one)","3 active sites","No ads","Email support"]', 2),
    ('Pro', 'pro', 20, 10, 40, TRUE, TRUE, TRUE, FALSE,
     '["40 AI generations/month","Custom domain support","10 active sites","No ads","DB-backed apps","Priority support"]', 3);

-- Site settings (singleton)
CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    free_user_cap INTEGER DEFAULT 200,
    free_user_budget_usd NUMERIC(8,2) DEFAULT 20.00,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    maintenance_message TEXT DEFAULT '',
    adsense_publisher_id VARCHAR(100) DEFAULT '',
    adsense_ad_unit_editor VARCHAR(100) DEFAULT '',
    adsense_ad_unit_sites VARCHAR(100) DEFAULT '',
    CHECK (id = 1)
);
INSERT INTO site_settings DEFAULT VALUES;

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    admitted_at TIMESTAMPTZ,
    admitted BOOLEAN DEFAULT FALSE
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

-- Extend users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_id INTEGER REFERENCES tiers(id) DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gens_used_this_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gens_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month');

-- Extend sites table
ALTER TABLE sites ADD COLUMN IF NOT EXISTS slug_type VARCHAR(20) DEFAULT 'generated';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS domain_cf_hostname_id VARCHAR(255);

-- Generation log (extend existing generations table with token tracking)
ALTER TABLE generations ADD COLUMN IF NOT EXISTS tokens_in INTEGER DEFAULT 0;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS tokens_out INTEGER DEFAULT 0;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS gen_type VARCHAR(20) DEFAULT 'generate';
