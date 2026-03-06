#!/bin/bash
set -e

DOMAIN="flowin.one"
SITES_DIR="/var/www/flowin-sites"
API_DIR="/opt/flowin-api"

echo "🔧 Updating system..."
apt update && apt upgrade -y

echo "📦 Installing packages..."
apt install -y nginx certbot python3-pip python3-venv ufw unzip

echo "🧱 Creating directories..."
mkdir -p $SITES_DIR
mkdir -p $API_DIR

echo "🛡️ Setting up UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "🧪 Testing Nginx config..."
systemctl enable nginx
systemctl start nginx

echo "🔐 Installing TLS certificate for wildcard domain..."
certbot certonly --nginx --agree-tos --no-eff-email -m you@$DOMAIN -d "$DOMAIN" -d "*.$DOMAIN"

echo "🧹 Setting up Nginx wildcard site for serving subdomains..."
cat >/etc/nginx/sites-available/flowin <<EOF
server {
    listen 80;
    listen 443 ssl;
    server_name ~^(?<subdomain>.+)\.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    root $SITES_DIR/\$subdomain;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF

ln -s /etc/nginx/sites-available/flowin /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default || true
nginx -t && systemctl reload nginx

echo "✅ Done: wildcard TLS + subdomain serving is active!"
echo "➡️ Put a test file at: $SITES_DIR/testslug/index.html"
echo "➡️ Visit: https://testslug.$DOMAIN"
