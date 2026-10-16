#!/bin/bash
# Install the aggregate-only usage report and its recurring timer.
set -euo pipefail
stage=$(cd -- "${1:?Pass the staging directory}" && pwd)
test "$(id -u)" = 0
test -d /var/www/moduls-hub/live-data
test -r /var/lib/tanoth-atlas/accounts.db
test -f "$stage/hub-usage-stats.py"
test -f "$stage/moduls-hub-usage-stats.service"
test -f "$stage/moduls-hub-usage-stats.timer"

backup=$(mktemp -d /var/backups/moduls-hub-usage-XXXXXX)
for existing in \
    /opt/moduls-hub-updater/hub-usage-stats.py \
    /etc/systemd/system/moduls-hub-usage-stats.service \
    /etc/systemd/system/moduls-hub-usage-stats.timer \
    /var/www/moduls-hub/live-data/usage-stats.json; do
    if test -f "$existing"; then cp -a "$existing" "$backup/"; fi
done
printf 'Rollback backup: %s\n' "$backup"

install -m 0755 "$stage/hub-usage-stats.py" /opt/moduls-hub-updater/hub-usage-stats.py
install -m 0644 "$stage/moduls-hub-usage-stats.service" /etc/systemd/system/moduls-hub-usage-stats.service
install -m 0644 "$stage/moduls-hub-usage-stats.timer" /etc/systemd/system/moduls-hub-usage-stats.timer
systemctl daemon-reload
systemctl start moduls-hub-usage-stats.service
systemctl enable --now moduls-hub-usage-stats.timer
printf 'Installed aggregate usage reporting. Raw identities are not included in the published JSON.\n'
