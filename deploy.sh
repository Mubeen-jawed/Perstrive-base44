#!/usr/bin/env bash
# Full first-time setup. Run on the VPS (Ubuntu/Debian), in the project folder:
#   ./deploy.sh
#
# Installs Node 22, PM2, nginx and certbot if missing, adds an nginx site for DOMAIN that
# proxies to 127.0.0.1:7006, gets an SSL certificate, starts PM2 on boot, schedules the Meta
# sync every 3 hours, then runs ./update.sh to build and start the app. Safe to re-run.
#
# Before running: the DNS A record for DOMAIN must point at this server (needed for SSL;
# logins only work over HTTPS in production), and .env must be in this folder.
set -euo pipefail

DOMAIN="base44.blendfoldmedia.com"
PORT=7006
CERTBOT_EMAIL="jawedmubeen905@gmail.com"   # Let's Encrypt expiry notices; leave empty to skip

cd "$(dirname "$0")"
APP_DIR="$(pwd)"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
export DEBIAN_FRONTEND=noninteractive

[ -f .env ] || { echo "!! No .env in $APP_DIR. Copy your .env here first."; exit 1; }
chmod 600 .env

echo "==> Packages"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi
command -v nginx   >/dev/null || $SUDO apt-get install -y nginx
command -v certbot >/dev/null || $SUDO apt-get install -y certbot python3-certbot-nginx
command -v pm2     >/dev/null || $SUDO npm install -g pm2
echo "    node $(node -v), pm2 $(pm2 -v)"

echo "==> nginx site for $DOMAIN"
SITE="/etc/nginx/sites-available/$DOMAIN"
if [ -f "$SITE" ]; then
  echo "    $SITE exists; leaving it alone."
else
  $SUDO tee "$SITE" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;   # "Sync Now" can take a while
    }
}
NGINX
  $SUDO ln -sf "$SITE" "/etc/nginx/sites-enabled/$DOMAIN"
fi
$SUDO nginx -t
$SUDO systemctl reload nginx

echo "==> SSL certificate"
if $SUDO test -d "/etc/letsencrypt/live/$DOMAIN"; then
  echo "    Certificate already exists."
else
  EMAIL_ARG="--register-unsafely-without-email"
  [ -n "$CERTBOT_EMAIL" ] && EMAIL_ARG="-m $CERTBOT_EMAIL"
  $SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect $EMAIL_ARG || {
    echo "    !! certbot failed: the DNS A record for $DOMAIN probably doesn't point here yet."
    echo "    !! Fix DNS, then re-run ./deploy.sh (logins need HTTPS)."
  }
fi

echo "==> PM2 on boot"
$SUDO env PATH="$PATH" pm2 startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null

echo "==> Meta sync every 3 hours (log: $APP_DIR/sync.log)"
SYNC_CMD="cd $APP_DIR && curl -s -m 290 -X POST -H \"Authorization: Bearer \$(grep '^CRON_SECRET=' .env | cut -d= -f2-)\" http://127.0.0.1:$PORT/api/sync/meta >> sync.log 2>&1; echo >> sync.log"
( crontab -l 2>/dev/null | grep -v "/api/sync/meta" || true
  echo "0 */3 * * * $SYNC_CMD" ) | crontab -

echo "==> Build and start"
bash ./update.sh

echo ""
echo "Done: https://$DOMAIN"
