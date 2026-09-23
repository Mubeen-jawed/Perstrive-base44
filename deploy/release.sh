#!/usr/bin/env bash
# Runs on the VPS for every deploy (called by deploy.sh).
# Unpacks the upload into a new release folder, installs, migrates, builds, switches
# the `current` symlink, reloads PM2, and rolls back if the app doesn't come up.
set -euo pipefail

APP_DIR="$1"
KEEP_RELEASES=5
RELEASE="$APP_DIR/releases/$(date +%Y%m%d-%H%M%S)"
PREVIOUS="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"

if [ ! -f "$APP_DIR/shared/.env" ]; then
  echo "!! $APP_DIR/shared/.env is missing. Run: ./deploy/deploy.sh env"; exit 1
fi

echo "==> Unpacking to $RELEASE"
mkdir -p "$RELEASE"
tar -xzf /tmp/perstrive-release.tgz -C "$RELEASE"
rm -f /tmp/perstrive-release.tgz
ln -sf "$APP_DIR/shared/.env" "$RELEASE/.env"

cd "$RELEASE"
echo "==> npm ci"
npm ci --no-audit --no-fund --loglevel=error
echo "==> Database schema"
npm run --silent db:migrate
echo "==> Build"
npm run --silent build

echo "==> Switching current -> $(basename "$RELEASE")"
ln -sfn "$RELEASE" "$APP_DIR/current"
APP_DIR="$APP_DIR" pm2 startOrReload "$RELEASE/ecosystem.config.cjs" --update-env
pm2 save >/dev/null

echo "==> Health check"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:7006/login || true)
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "$code" != "200" ]; then
  echo "!! App didn't respond (last status: $code)."
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "!! Rolling back to $(basename "$PREVIOUS")"
    ln -sfn "$PREVIOUS" "$APP_DIR/current"
    APP_DIR="$APP_DIR" pm2 startOrReload "$PREVIOUS/ecosystem.config.cjs" --update-env
  fi
  pm2 logs perstrive-dashboard --lines 40 --nostream || true
  exit 1
fi

echo "==> Cleaning old releases (keeping $KEEP_RELEASES)"
ls -1dt "$APP_DIR"/releases/* | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

echo "==> Live: $(basename "$RELEASE")"
