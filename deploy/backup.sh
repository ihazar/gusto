#!/bin/sh
# Nightly pg_dump of gusto-db. Installed by deploy.sh as /etc/cron.daily/gusto-backup.
# ponytail: on-server copies only, 14-day retention; add offsite (rclone) if the data matters more than the box.
set -eu
OUT=/opt/gusto-backups
mkdir -p "$OUT"
docker exec gusto-db pg_dump -U gusto -Fc gusto > "$OUT/gusto-$(date +%F).dump"
find "$OUT" -name 'gusto-*.dump' -mtime +14 -delete
