#!/usr/bin/env bash
# Full first-time deploy to the VPS. Run from Git Bash in the project folder:  ./deploy.sh
#
# On the server (Ubuntu/Debian): installs Node 22, PM2, nginx and certbot if missing, adds an
# nginx site for DOMAIN -> 127.0.0.1:7006, gets an SSL certificate, starts PM2 on boot,
# schedules the Meta sync every 3 hours, uploads your local .env, then runs ./update.sh.
# Safe to re-run. For later code changes, just run ./update.sh.
#
# Before running: point a DNS A record for DOMAIN at the VPS IP (needed for SSL; logins
# only work over HTTPS in production).
set -euo pipefail

# ---- Settings (keep in sync with update.sh) ----
VPS_HOST="${VPS_HOST:-}"                 # VPS IP address, e.g. 203.0.113.10
VPS_USER="${VPS_USER:-root}"             # needs sudo if not root
SSH_PORT="${SSH_PORT:-22}"
APP_DIR="${APP_DIR:-/var/www/perstrive-dashboard}"
DOMAIN="${DOMAIN:-base44.blendfoldmedia.com}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"       # optional: Let's Encrypt expiry notices
PORT=7006
# -------------------------------------------------

[ -n "$VPS_HOST" ] || { echo "Set VPS_HOST at the top of deploy.sh"; exit 1; }
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="$VPS_USER@$VPS_HOST"
[ -f "$ROOT/.env" ] || { echo "No .env in $ROOT"; exit 1; }

echo "==> Setting up $TARGET for $DOMAIN"
ssh -p "$SSH_PORT" -o ServerAliveInterval=30 "$TARGET" \
  bash -s -- "$DOMAIN" "$APP_DIR" "$PORT" "$CERTBOT_EMAIL" <<'REMOTE'
set -euo pipefail
DOMAIN="$1"; APP_DIR="$2"; PORT="$3"; CERTBOT_EMAIL="$4"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
export DEBIAN_FRONTEND=noninteractive

echo "==> Packages"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi
command -v nginx   >/dev/null || $SUDO apt-get install -y nginx
command -v certbot >/dev/null || $SUDO apt-get install -y certbot python3-certbot-nginx
command -v pm2     >/dev/null || $SUDO npm install -g pm2
echo "    node $(node -v), pm2 $(pm2 -v)"

echo "==> Folders"
$SUDO mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
$SUDO chown -R "$(id -un):$(id -gn)" "$APP_DIR"

echo "==> nginx site"
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

echo "==> SSL"
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

echo "==> Meta sync every 3 hours"
cat > "$APP_DIR/shared/sync-meta.sh" <<SYNC
#!/usr/bin/env bash
SECRET=\$(grep '^CRON_SECRET=' "$APP_DIR/shared/.env" | cut -d= -f2-)
echo "\$(date -Is) \$(curl -s -m 290 -X POST -H "Authorization: Bearer \$SECRET" http://127.0.0.1:$PORT/api/sync/meta)"
SYNC
chmod +x "$APP_DIR/shared/sync-meta.sh"
( crontab -l 2>/dev/null | grep -v "sync-meta.sh" || true
  echo "0 */3 * * * $APP_DIR/shared/sync-meta.sh >> $APP_DIR/shared/sync.log 2>&1" ) | crontab -
REMOTE

echo "==> Uploading .env"
scp -P "$SSH_PORT" -q "$ROOT/.env" "$TARGET:$APP_DIR/shared/.env"
ssh -p "$SSH_PORT" "$TARGET" "chmod 600 '$APP_DIR/shared/.env'"

echo "==> Deploying code"
VPS_HOST="$VPS_HOST" VPS_USER="$VPS_USER" SSH_PORT="$SSH_PORT" APP_DIR="$APP_DIR" DOMAIN="$DOMAIN" \
  bash "$ROOT/update.sh"
