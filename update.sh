#!/usr/bin/env bash
# Ships the current code to the VPS. Run from Git Bash in the project folder:  ./update.sh
#
# Uploads the code into a new release folder, runs npm ci + db:migrate + build, switches the
# live site to it and restarts the app. If the app doesn't come up, it rolls back to the
# previous release. Needs ./deploy.sh to have been run once first.
set -euo pipefail

# ---- Settings (keep in sync with deploy.sh) ----
VPS_HOST="${VPS_HOST:-}"                 # VPS IP address, e.g. 203.0.113.10
VPS_USER="${VPS_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
APP_DIR="${APP_DIR:-/var/www/perstrive-dashboard}"
DOMAIN="${DOMAIN:-base44.blendfoldmedia.com}"
PORT=7006
# -------------------------------------------------

[ -n "$VPS_HOST" ] || { echo "Set VPS_HOST at the top of update.sh"; exit 1; }
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="$VPS_USER@$VPS_HOST"

echo "==> Packaging code"
ARCHIVE="$(mktemp -t perstrive-XXXXXX).tgz"
tar -czf "$ARCHIVE" -C "$ROOT" \
  --exclude=./node_modules --exclude=./.next --exclude=./.next-dev \
  --exclude=./.env --exclude=./.env.local --exclude=./.git \
  --exclude=./preview-overview.png --exclude=./tsconfig.tsbuildinfo \
  .
echo "    $(du -h "$ARCHIVE" | cut -f1)"

echo "==> Uploading to $TARGET"
scp -P "$SSH_PORT" -q "$ARCHIVE" "$TARGET:/tmp/perstrive-release.tgz"
rm -f "$ARCHIVE"

ssh -p "$SSH_PORT" -o ServerAliveInterval=30 "$TARGET" bash -s -- "$APP_DIR" "$PORT" <<'REMOTE'
set -euo pipefail
APP_DIR="$1"; PORT="$2"
NAME="perstrive-dashboard"
RELEASE="$APP_DIR/releases/$(date +%Y%m%d-%H%M%S)"
PREVIOUS="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"

[ -f "$APP_DIR/shared/.env" ] || { echo "!! $APP_DIR/shared/.env missing. Run ./deploy.sh first."; exit 1; }

echo "==> Unpacking $(basename "$RELEASE")"
mkdir -p "$RELEASE"
tar -xzf /tmp/perstrive-release.tgz -C "$RELEASE"
rm -f /tmp/perstrive-release.tgz
ln -sf "$APP_DIR/shared/.env" "$RELEASE/.env"
cd "$RELEASE"

echo "==> npm ci";      npm ci --no-audit --no-fund --loglevel=error
echo "==> db:migrate";  npm run --silent db:migrate
echo "==> build";       npm run --silent build

start_app() {
  ln -sfn "$1" "$APP_DIR/current"
  if pm2 describe "$NAME" >/dev/null 2>&1; then
    pm2 restart "$NAME" --update-env >/dev/null
  else
    # cwd is the `current` symlink, so a restart always runs the release it points at.
    NODE_ENV=production pm2 start node_modules/next/dist/bin/next --name "$NAME" \
      --cwd "$APP_DIR/current" --time --max-memory-restart 700M \
      -- start -p "$PORT" -H 127.0.0.1 >/dev/null
  fi
  pm2 save >/dev/null
}

echo "==> Going live"
start_app "$RELEASE"

code=000
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login" || true)
  [ "$code" = "200" ] && break
  sleep 1
done

if [ "$code" != "200" ]; then
  echo "!! App didn't respond (status $code)."
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ] && [ "$PREVIOUS" != "$RELEASE" ]; then
    echo "!! Rolling back to $(basename "$PREVIOUS")"
    start_app "$PREVIOUS"
  fi
  pm2 logs "$NAME" --lines 40 --nostream || true
  exit 1
fi

# Keep the 5 newest releases.
ls -1dt "$APP_DIR"/releases/* | tail -n +6 | xargs -r rm -rf
echo "==> Live: $(basename "$RELEASE")"
REMOTE

echo ""
echo "Done: https://$DOMAIN"
