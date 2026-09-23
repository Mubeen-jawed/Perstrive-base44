#!/usr/bin/env bash
# Updates the live site with the code in this folder. Run on the VPS, in the project folder:
#   ./update.sh
#
# Pulls the latest code (if this is a git checkout), installs packages, applies the database
# schema, builds into .next-build while the current site keeps running, then swaps the new
# build in and restarts the app. If the app doesn't come up, the previous build is restored.
set -euo pipefail

PORT=7006
NAME="perstrive-dashboard"

cd "$(dirname "$0")"
APP_DIR="$(pwd)"

[ -f .env ] || { echo "!! No .env in $APP_DIR. Copy your .env here first."; exit 1; }

if [ -d .git ]; then
  echo "==> git pull"
  git pull --ff-only
fi

echo "==> npm ci"
npm ci --no-audit --no-fund --loglevel=error

echo "==> Database schema"
npm run --silent db:migrate

echo "==> Build"
rm -rf .next-build
NEXT_DIST_DIR=.next-build npm run --silent build

echo "==> Swapping in the new build"
rm -rf .next-old
[ -d .next ] && mv .next .next-old
mv .next-build .next

start_app() {
  if pm2 describe "$NAME" >/dev/null 2>&1; then
    pm2 restart "$NAME" --update-env >/dev/null
  else
    NODE_ENV=production pm2 start node_modules/next/dist/bin/next --name "$NAME" \
      --cwd "$APP_DIR" --time --max-memory-restart 700M \
      -- start -p "$PORT" -H 127.0.0.1 >/dev/null
  fi
  pm2 save >/dev/null
}

healthy() {
  local code=000
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login" || true)
    [ "$code" = "200" ] && return 0
    sleep 1
  done
  echo "!! App didn't respond (status $code)."
  return 1
}

start_app
if ! healthy; then
  if [ -d .next-old ]; then
    echo "!! Restoring the previous build"
    rm -rf .next && mv .next-old .next
    start_app
  fi
  pm2 logs "$NAME" --lines 40 --nostream || true
  exit 1
fi

rm -rf .next-old
echo "==> Live on 127.0.0.1:$PORT (pm2: $NAME)"
