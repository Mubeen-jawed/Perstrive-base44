#!/usr/bin/env bash
# Deploys the Perstrive dashboard to the VPS. Run from Git Bash in the project folder.
#
#   ./deploy/deploy.sh setup   first time: installs Node/PM2/nginx/SSL, uploads .env, then deploys
#   ./deploy/deploy.sh         deploy the current code
#   ./deploy/deploy.sh env     upload your local .env to the server (replaces the server's copy)
#   ./deploy/deploy.sh ssl     retry the SSL certificate (after DNS points at the VPS)
#   ./deploy/deploy.sh logs    tail the app logs
#   ./deploy/deploy.sh status  PM2 status
#
# Settings come from deploy/deploy.config (copy deploy/deploy.config.example).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/deploy/deploy.config"
[ -f "$CONFIG" ] || { echo "Missing $CONFIG. Copy deploy/deploy.config.example and fill it in."; exit 1; }
# shellcheck source=/dev/null
source "$CONFIG"

: "${VPS_HOST:?Set VPS_HOST in deploy/deploy.config}"
VPS_USER="${VPS_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
DOMAIN="${DOMAIN:-base44.blendfoldmedia.com}"
APP_DIR="${APP_DIR:-/var/www/perstrive-dashboard}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
EMAIL_ARG="--register-unsafely-without-email"
[ -n "$CERTBOT_EMAIL" ] && EMAIL_ARG="-m $CERTBOT_EMAIL"

TARGET="$VPS_USER@$VPS_HOST"
SSH=(ssh -p "$SSH_PORT" -o ServerAliveInterval=30 "$TARGET")
SCP=(scp -P "$SSH_PORT" -q)

upload_env() {
  [ -f "$ROOT/.env" ] || { echo "No local .env to upload."; exit 1; }
  echo "==> Uploading .env"
  "${SCP[@]}" "$ROOT/.env" "$TARGET:/tmp/perstrive.env"
  "${SSH[@]}" "mkdir -p '$APP_DIR/shared' && mv /tmp/perstrive.env '$APP_DIR/shared/.env' && chmod 600 '$APP_DIR/shared/.env'"
}

setup() {
  echo "==> Setting up $TARGET for $DOMAIN"
  "${SCP[@]}" "$ROOT/deploy/setup-server.sh" "$TARGET:/tmp/perstrive-setup.sh"
  "${SCP[@]}" "$ROOT/deploy/nginx.conf" "$TARGET:/tmp/perstrive-nginx.conf"
  "${SSH[@]}" "bash /tmp/perstrive-setup.sh '$DOMAIN' '$APP_DIR' '$CERTBOT_EMAIL'"
  if "${SSH[@]}" "test -f '$APP_DIR/shared/.env'"; then
    echo "==> Server already has a .env; keeping it (use './deploy/deploy.sh env' to replace)."
  else
    upload_env
  fi
}

deploy() {
  echo "==> Packaging"
  local archive
  archive="$(mktemp -t perstrive-XXXXXX).tgz"
  tar -czf "$archive" -C "$ROOT" \
    --exclude=./node_modules --exclude=./.next --exclude=./.next-dev \
    --exclude=./.env --exclude=./.env.local --exclude=./deploy/deploy.config \
    --exclude=./preview-overview.png --exclude=./tsconfig.tsbuildinfo --exclude=./.git \
    .
  echo "   $(du -h "$archive" | cut -f1)"

  echo "==> Uploading to $TARGET"
  "${SCP[@]}" "$archive" "$TARGET:/tmp/perstrive-release.tgz"
  "${SCP[@]}" "$ROOT/deploy/release.sh" "$TARGET:/tmp/perstrive-release.sh"
  rm -f "$archive"

  "${SSH[@]}" "bash /tmp/perstrive-release.sh '$APP_DIR'"
  echo ""
  echo "Deployed: https://$DOMAIN"
}

case "${1:-deploy}" in
  setup)  setup; deploy ;;
  deploy) deploy ;;
  env)    upload_env; "${SSH[@]}" "cd '$APP_DIR/current' && APP_DIR='$APP_DIR' pm2 reload ecosystem.config.cjs --update-env" ;;
  ssl)    "${SSH[@]}" "sudo certbot --nginx -d '$DOMAIN' --non-interactive --agree-tos --redirect $EMAIL_ARG" ;;
  logs)   "${SSH[@]}" "pm2 logs perstrive-dashboard --lines 100" ;;
  status) "${SSH[@]}" "pm2 status perstrive-dashboard; tail -n 5 '$APP_DIR/shared/sync.log' 2>/dev/null || true" ;;
  *)      sed -n '2,12p' "$0"; exit 1 ;;
esac
