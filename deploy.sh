#!/usr/bin/env bash
# Full first-time setup. Run on the VPS (Ubuntu/Debian), in the project folder:
#   ./deploy.sh
#
# Installs Node 22, PM2, nginx, certbot and PostgreSQL if missing, creates the local database
# (DB_NAME/DB_USER) and points DATABASE_URL in .env at it, adds an nginx site for DOMAIN that
# proxies to 127.0.0.1:7006, gets an SSL certificate, starts PM2 on boot, schedules the Meta
# sync every hour, runs ./update.sh to build and start the app, then creates the admin
# user, imports the SCF ad accounts and runs a first sync. Safe to re-run.
#
# Before running: the DNS A record for DOMAIN must point at this server (needed for SSL;
# logins only work over HTTPS in production), and .env must be in this folder.
set -euo pipefail

DOMAIN="base44.blendfoldmedia.com"
PORT=7006
CERTBOT_EMAIL="jawedmubeen905@gmail.com"   # Let's Encrypt expiry notices; leave empty to skip
DB_NAME="perstrive"                        # local PostgreSQL database + user created on this VPS
DB_USER="perstrive"

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

echo "==> PostgreSQL database"
command -v psql >/dev/null || $SUDO apt-get install -y postgresql
$SUDO systemctl enable --now postgresql >/dev/null 2>&1 || true
as_pg() { if [ "$(id -u)" -eq 0 ]; then runuser -u postgres -- "$@"; else sudo -u postgres "$@"; fi; }
for _ in $(seq 1 15); do as_pg psql -qtAc "select 1" >/dev/null 2>&1 && break; sleep 1; done
PG_PORT="$(as_pg psql -qtAc 'show port')"

CURRENT_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- || true)"
if [[ "$CURRENT_URL" == *"@localhost:$PG_PORT/$DB_NAME"* ]]; then
  # Already pointing at this server's database: reuse its password.
  DB_PASS="$(sed -E 's#^[a-z]+://[^:]+:([^@]+)@.*#\1#' <<<"$CURRENT_URL")"
  echo "    .env already uses the local database."
else
  DB_PASS="$(openssl rand -hex 24)"
fi

if [ "$(as_pg psql -qtAc "select 1 from pg_roles where rolname = '$DB_USER'")" = "1" ]; then
  as_pg psql -qc "alter role $DB_USER with login password '$DB_PASS'"
else
  as_pg psql -qc "create role $DB_USER with login password '$DB_PASS'"
  echo "    Created role $DB_USER"
fi
if [ "$(as_pg psql -qtAc "select 1 from pg_database where datname = '$DB_NAME'")" != "1" ]; then
  as_pg createdb -O "$DB_USER" "$DB_NAME"
  echo "    Created database $DB_NAME"
fi
# gen_random_uuid() is built in from PostgreSQL 13; pgcrypto provides it on older versions.
as_pg psql -q -d "$DB_NAME" -c "create extension if not exists pgcrypto"

LOCAL_URL="postgres://$DB_USER:$DB_PASS@localhost:$PG_PORT/$DB_NAME"
if [ "$CURRENT_URL" != "$LOCAL_URL" ]; then
  BACKUP=".env.bak-$(date +%Y%m%d-%H%M%S)"
  cp .env "$BACKUP" && chmod 600 "$BACKUP"
  if grep -q '^DATABASE_URL=' .env; then
    sed -i "s#^DATABASE_URL=.*#DATABASE_URL=$LOCAL_URL#" .env
  else
    echo "DATABASE_URL=$LOCAL_URL" >> .env
  fi
  echo "    .env DATABASE_URL -> local database (previous .env saved as $BACKUP)"
fi

echo "==> nginx site for $DOMAIN"
# conf.d/ is loaded by both Debian-style and nginx.org installs. The file is fully managed
# here (HTTP + HTTPS), so certbot never edits nginx config for this domain.
SITE="/etc/nginx/conf.d/$DOMAIN.conf"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
ACME_ROOT="/var/www/letsencrypt"
# Earlier versions of this script used sites-available/sites-enabled.
$SUDO rm -f "/etc/nginx/sites-enabled/$DOMAIN" "/etc/nginx/sites-available/$DOMAIN"

# Another server block for this domain (e.g. one certbot cloned from another site's
# default_server, pointing at that site's port) would conflict with ours. Stop and show it.
OTHERS="$($SUDO grep -rlE "server_name[^;]*[[:space:]]${DOMAIN//./\.}([[:space:]]|;)" /etc/nginx 2>/dev/null \
  | xargs -r -n1 readlink -f | sort -u | grep -vx "$SITE" || true)"
if [ -n "$OTHERS" ]; then
  echo "    !! These nginx files also define $DOMAIN and would override this app:"
  for f in $OTHERS; do $SUDO grep -nF "$DOMAIN" "$f" | sed "s#^#       $f:#"; done
  echo "    !! Remove the $DOMAIN server block(s) from those files, then re-run ./deploy.sh."
  exit 1
fi

write_site() {  # $1 = ssl | nossl
  local http_body
  if [ "$1" = ssl ]; then
    http_body="location / { return 301 https://\$host\$request_uri; }"
  else
    http_body="location / { proxy_pass http://127.0.0.1:$PORT; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; }"
  fi
  {
    cat <<NGINX
# Managed by deploy.sh (Perstrive dashboard). Re-running deploy.sh rewrites this file.
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ { root $ACME_ROOT; }
    $http_body
}
NGINX
    [ "$1" = ssl ] && cat <<NGINX

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;

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
    true
  } | $SUDO tee "$SITE" >/dev/null
  $SUDO nginx -t
  $SUDO systemctl reload nginx
}

$SUDO mkdir -p "$ACME_ROOT"
if ! $SUDO test -f "$CERT_DIR/fullchain.pem"; then
  write_site nossl
  echo "==> SSL certificate"
  EMAIL_ARG="--register-unsafely-without-email"
  [ -n "$CERTBOT_EMAIL" ] && EMAIL_ARG="-m $CERTBOT_EMAIL"
  # certonly + webroot: gets the certificate without touching any nginx files.
  $SUDO certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
    --non-interactive --agree-tos --keep-until-expiring $EMAIL_ARG || {
    echo "    !! certbot failed. Check the DNS A record for $DOMAIN points at this server:"
    echo "    !!   getent hosts $DOMAIN"
    echo "    !! then re-run ./deploy.sh (logins need HTTPS)."
  }
fi
if $SUDO test -f "$CERT_DIR/fullchain.pem"; then
  write_site ssl
  # Reload nginx after automatic renewals.
  echo 'systemctl reload nginx' | $SUDO tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null
  $SUDO chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  echo "    HTTPS configured."
fi

echo "==> PM2 on boot"
$SUDO env PATH="$PATH" pm2 startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null

echo "==> Meta sync every hour (log: $APP_DIR/sync.log)"
SYNC_CMD="cd $APP_DIR && curl -s -m 290 -X POST -H \"Authorization: Bearer \$(grep '^CRON_SECRET=' .env | cut -d= -f2-)\" http://127.0.0.1:$PORT/api/sync/meta >> sync.log 2>&1; echo >> sync.log"
( crontab -l 2>/dev/null | grep -v "/api/sync/meta" || true
  echo "0 * * * * $SYNC_CMD" ) | crontab -

echo "==> Build and start"
bash ./update.sh

echo "==> Admin user and Meta accounts"
npm run --silent db:seed
if grep -q '^META_ACCESS_TOKEN=.' .env; then
  npm run --silent meta:import -- scf
  if [ "$(psql "$LOCAL_URL" -qtAc 'select count(*) from daily_metrics')" = "0" ]; then
    echo "==> First Meta sync (can take a minute)"
    SECRET="$(grep -m1 '^CRON_SECRET=' .env | cut -d= -f2-)"
    curl -s -m 290 -X POST -H "Authorization: Bearer $SECRET" "http://127.0.0.1:$PORT/api/sync/meta" | head -c 300; echo
  fi
else
  echo "    META_ACCESS_TOKEN not set; skipping Meta import."
fi

echo "==> Checking $DOMAIN serves this app"
# Ask this server's nginx for the domain (ignores DNS) and look for text from our login page.
check() {  # $1 = http|https
  curl -sk -L --max-redirs 3 --resolve "$DOMAIN:80:127.0.0.1" --resolve "$DOMAIN:443:127.0.0.1" \
    "$1://$DOMAIN/login" | grep -q "Ask your Perstrive admin"
}
for p in http https; do
  if check $p; then echo "    $p://$DOMAIN -> OK"
  else echo "    !! $p://$DOMAIN is NOT serving this app (another nginx site is answering)."; fi
done

echo ""
echo "Done: https://$DOMAIN"
