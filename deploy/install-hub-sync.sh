#!/bin/bash
# Install staged hub synchronization files; existing app routing is preserved.
set -euo pipefail
stage=$(cd -- "${1:?Pass the staging directory}" && pwd)
test "$(id -u)" = 0
test -L /var/www/moduls-hub/current
test -s /var/lib/moduls-hub-updater/script-updates.json
test -f "$stage/sync-hub.py"
backup=$(mktemp -d /var/backups/moduls-hub-sync-XXXXXX)
cp -a /etc/nginx/snippets/moduls-hub-static.conf "$backup/nginx-static.conf"
cp -a /opt/moduls-hub-updater "$backup/updater"
cp -a /etc/systemd/system/moduls-hub-script-updater.service "$backup/updater.service"
cp -a /var/lib/moduls-hub-updater/script-updates.json "$backup/script-updates.json"
readlink -f /var/www/moduls-hub/current > "$backup/previous-release.txt"
printf 'Rollback backup: %s\n' "$backup"

install -d -m 0755 /var/www/moduls-hub/live-data
install -m 0644 /var/lib/moduls-hub-updater/script-updates.json /var/www/moduls-hub/live-data/script-updates.json
install -m 0644 "$stage/nginx-hub-release-feed.conf" /etc/nginx/snippets/moduls-hub-release-feed.conf
if ! grep -Fqx 'include /etc/nginx/snippets/moduls-hub-release-feed.conf;' /etc/nginx/snippets/moduls-hub-static.conf; then
    printf '\ninclude /etc/nginx/snippets/moduls-hub-release-feed.conf;\n' >> /etc/nginx/snippets/moduls-hub-static.conf
fi
if ! nginx -t; then
    cp -a "$backup/nginx-static.conf" /etc/nginx/snippets/moduls-hub-static.conf
    exit 1
fi
systemctl reload nginx

install -m 0755 "$stage/sync-hub.py" /opt/moduls-hub-updater/sync-hub.py
install -m 0644 "$stage/moduls-hub-site-sync.service" /etc/systemd/system/moduls-hub-site-sync.service
install -m 0644 "$stage/moduls-hub-site-sync.timer" /etc/systemd/system/moduls-hub-site-sync.timer
systemctl stop moduls-hub-script-updater.timer
systemctl stop moduls-hub-script-updater.service
install -m 0755 "$stage/sync-versions.py" /opt/moduls-hub-updater/sync-versions.py
install -m 0644 "$stage/script-update-sources.json" /opt/moduls-hub-updater/script-update-sources.json
install -m 0644 "$stage/moduls-hub-script-updater.service" /etc/systemd/system/moduls-hub-script-updater.service
systemctl daemon-reload
systemctl start moduls-hub-script-updater.timer
printf 'Installed. Start moduls-hub-site-sync.timer after GitHub Pages publishes site-files.json.\n'
