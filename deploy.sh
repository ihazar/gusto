#!/usr/bin/env bash
# Deploy Gusto to the Hetzner VPS (https://gustochefs.com).
# Server layout: /opt/gusto, systemd unit "gusto" on 127.0.0.1:4783, Redis in
# docker containers gusto-db (Postgres 17, 127.0.0.1:4780) and gusto-redis
# (127.0.0.1:4782), Caddy terminates TLS. Secrets live only on the server:
# /opt/gusto/.env (DB password, read by compose) and /opt/gusto/apps/api/.env
# (see deploy/env.example); deploys never touch them.
set -euo pipefail
HOST=root@178.104.237.3
DIR=/opt/gusto
DOMAIN=gustochefs.com

rsync -az --delete \
    --exclude .git --exclude node_modules --exclude '.env' \
    --exclude 'apps/api/dist' --exclude 'apps/web/dist' --exclude 'apps/web/.angular' \
    --exclude 'libs/contracts/dist' --exclude '.nx' --exclude '*.tsbuildinfo' \
    --exclude 'apps/mobile/.expo' \
    "$(cd "$(dirname "$0")" && pwd)/" "$HOST":$DIR/

ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $DIR

if [ ! -f apps/api/.env ]; then
    echo "!! $DIR/apps/api/.env missing on the server — create it from deploy/env.example first" >&2
    exit 1
fi

docker compose --env-file .env -f deploy/docker-compose.yml up -d
cp deploy/gusto.service /etc/systemd/system/gusto.service
install -m 755 deploy/backup.sh /etc/cron.daily/gusto-backup
systemctl daemon-reload
systemctl enable gusto >/dev/null 2>&1 || true

if ! grep -q "^$DOMAIN" /etc/caddy/Caddyfile; then
    echo "== adding Caddy site block"
    cat deploy/Caddyfile >> /etc/caddy/Caddyfile
    caddy validate --config /etc/caddy/Caddyfile >/dev/null && systemctl reload caddy
fi

npm ci --no-audit --no-fund
npm run build:prod
(cd apps/api && npx prisma migrate deploy)
systemctl restart gusto
sleep 3
systemctl is-active gusto
curl -s -o /dev/null -w 'local api -> %{http_code}\n' http://127.0.0.1:4783/api/health
REMOTE

curl -s -o /dev/null -m 15 -w "https://$DOMAIN -> %{http_code}\n" "https://$DOMAIN/api/health" || echo "https://$DOMAIN not reachable yet (DNS/TLS)"
