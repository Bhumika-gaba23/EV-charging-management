#!/bin/sh
# Pulls the latest main, rebuilds and restarts with zero manual steps. Data in the
# pluggo-data volume is kept. Run from deployment/vm/.
set -eu
cd "$(dirname "$0")"
[ -f .env ] || { echo "Missing .env: cp .env.example .env and fill it in"; exit 1; }
grep -q '^PLUGGO_DOMAIN=.\+' .env || { echo "Set PLUGGO_DOMAIN in .env"; exit 1; }
git -C ../.. pull --ff-only
docker compose build pluggo
docker compose up -d
echo "Waiting for the app to report ready..."
domain=$(sed -n 's/^PLUGGO_DOMAIN=//p' .env)
for i in $(seq 60); do
  if docker compose exec -T pluggo python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:10000/api/ready', timeout=3)" 2>/dev/null; then
    echo "Pluggo is up: https://$domain"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done
echo "The app did not become ready. Logs:"; docker compose logs --tail 80 pluggo; exit 1
