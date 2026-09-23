#!/usr/bin/env bash
# One-time VPS setup (Ubuntu/Debian). Safe to re-run.
# Installs Node 22, PM2, nginx and certbot if missing, adds the nginx site for DOMAIN,
# requests an SSL certificate, and schedules the Meta sync.
# Run by `deploy.sh setup` — not meant to be run by hand.
set -euo pipefail

DOMAIN="$1"
APP_DIR="$2"
CERTBOT_EMAIL="${3:-}"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "==> Packages"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi
command -v nginx   >/dev/null || $SUDO apt-get install -y nginx
command -v certbot >/dev/null || $SUDO apt-get install -y certbot python3-certbot-nginx
command -v pm2     >/dev/null || $SUDO npm install -g pm2
echo "node $(node -v), pm2 $(pm2 -v)"

echo "==> App folders ($APP_DIR)"
$SUDO mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
$SUDO chown -R "$(id -un)":"$(id -gn)" "$APP_DIR"

echo "==> nginx site for $DOMAIN"
SITE="/etc/nginx/sites-available/$DOMAIN"
if [ ! -f "$SITE" ]; then
  sed "s/__DOMAIN__/$DOMAIN/g" /tmp/perstrive-nginx.conf | $SUDO tee "$SITE" >/dev/null
  $SUDO ln -sf "$SITE" "/etc/nginx/sites-enabled/$DOMAIN"
else
  echo "   $SITE already exists; leaving it as is."
fi
$SUDO nginx -t
$SUDO systemctl reload nginx

echo "==> SSL certificate"
if $SUDO test -d "/etc/letsencrypt/live/$DOMAIN"; then
  echo "   Certificate already exists."
else
  EMAIL_ARG="--register-unsafely-without-email"
  [ -n "$CERTBOT_EMAIL" ] && EMAIL_ARG="-m $CERTBOT_EMAIL"
  if ! $SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect $EMAIL_ARG; then
    echo ""
    echo "   !! certbot failed. Usually the DNS A record for $DOMAIN doesn't point at this server yet."
    echo "   !! Once it does, run:  ./deploy/deploy.sh ssl"
    echo "   !! Logins need HTTPS in production (the session cookie is Secure)."
  fi
fi

echo "==> Start on boot"
$SUDO env PATH="$PATH" pm2 startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null

echo "==> Meta sync every 3 hours"
CRON_LINE="0 */3 * * * $APP_DIR/shared/sync-meta.sh >> $APP_DIR/shared/sync.log 2>&1"
cat > "$APP_DIR/shared/sync-meta.sh" <<EOF
#!/usr/bin/env bash
SECRET=\$(grep '^CRON_SECRET=' "$APP_DIR/shared/.env" | cut -d= -f2-)
echo "\$(date -Is) \$(curl -s -m 290 -X POST -H "Authorization: Bearer \$SECRET" http://127.0.0.1:7006/api/sync/meta)"
EOF
chmod +x "$APP_DIR/shared/sync-meta.sh"
( crontab -l 2>/dev/null | grep -v "sync-meta.sh" ; echo "$CRON_LINE" ) | crontab -

echo "==> Server setup done."
