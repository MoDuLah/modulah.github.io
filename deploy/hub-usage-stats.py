#!/usr/bin/env python3
"""Publish privacy-safe Hub and hosted-tool usage aggregates.

The generated JSON contains counts only. Torn IDs, IP addresses, user agents,
session tokens and API keys never leave their existing data stores.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


POSTGRES_TOOLS = {
    "pythagorasDashboard": {
        "name": "Pythagoras Dashboard",
        "database": "pp_licences",
        "registered": "SELECT user_id::text FROM users",
        "active": "SELECT user_id::text FROM users WHERE last_seen_at >= now() - interval '{days} days'",
    },
    "jobCentrePlus": {
        "name": "JobCentre+",
        "database": "jobcentreplus",
        "registered": "SELECT torn_id::text FROM users",
        "active": """
            SELECT u.torn_id::text
            FROM users u
            WHERE GREATEST(
                COALESCE(u.last_login_at, 'epoch'),
                COALESCE((SELECT MAX(s.last_seen_at) FROM sessions s WHERE s.torn_id=u.torn_id), 'epoch')
            ) >= now() - interval '{days} days'
        """,
    },
    "pitGuruWeb": {
        "name": "Pit Guru Web Tool",
        "database": "pit_guru",
        "registered": "SELECT user_id::text FROM pit_guru_users",
        "active": """
            SELECT user_id::text
            FROM pit_guru_users
            WHERE last_seen_at::timestamptz >= now() - interval '{days} days'
        """,
    },
    "tornfolio": {
        "name": "Tornfolio",
        "database": "landlord_ledger",
        "registered": "SELECT DISTINCT user_id::text FROM landlord_ledger_sessions",
        "active": """
            SELECT DISTINCT user_id::text
            FROM landlord_ledger_sessions
            WHERE revoked_at IS NULL AND last_seen_at >= now() - interval '{days} days'
        """,
    },
}


def psql_command(database: str, sql: str, psql_user: str) -> list[str]:
    command = ["psql", "--no-psqlrc", "--tuples-only", "--no-align", "--quiet", "-d", database, "-c", sql]
    get_effective_user_id = getattr(os, "geteuid", lambda: -1)
    if get_effective_user_id() == 0 and psql_user:
        return ["runuser", "-u", psql_user, "--", *command]
    return command


def postgres_rows(database: str, sql: str, psql_user: str) -> set[str]:
    result = subprocess.run(
        psql_command(database, sql, psql_user),
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def postgres_scalar(database: str, sql: str, psql_user: str) -> int:
    rows = postgres_rows(database, sql, psql_user)
    if len(rows) != 1:
        raise ValueError(f"Expected one aggregate value from {database}")
    return int(next(iter(rows)))


def atlas_counts(path: Path) -> dict[str, int]:
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        registered = connection.execute(
            "SELECT COUNT(*) FROM atlas_accounts WHERE active=1"
        ).fetchone()[0]
        active_7d = connection.execute(
            "SELECT COUNT(*) FROM atlas_accounts "
            "WHERE active=1 AND last_used_at >= datetime('now','-7 days')"
        ).fetchone()[0]
        active_30d = connection.execute(
            "SELECT COUNT(*) FROM atlas_accounts "
            "WHERE active=1 AND last_used_at >= datetime('now','-30 days')"
        ).fetchone()[0]
    finally:
        connection.close()
    return {"registered": registered, "active7d": active_7d, "active30d": active_30d}


def anonymous_activity(path_pattern: str, days: int, psql_user: str) -> int:
    escaped_pattern = path_pattern.replace("'", "''")
    return postgres_scalar(
        "pp_licences",
        f"""
            SELECT COUNT(DISTINCT (ip_address::text, COALESCE(user_agent,'')))
            FROM api_request_log
            WHERE path LIKE '{escaped_pattern}'
              AND created_at >= now() - interval '{days} days'
              AND ip_address IS NOT NULL
              AND COALESCE(user_agent,'') !~* '(bot|crawler|spider|uptime|monitor|curl|wget|python|github)'
        """,
        psql_user,
    )


def prune_activity_logs(retention_days: int, psql_user: str) -> None:
    postgres_rows(
        "pp_licences",
        f"""
            DELETE FROM api_request_log
            WHERE created_at < now() - interval '{retention_days} days'
              AND (path = '/api/hub-activity' OR path LIKE '/racestats%')
        """,
        psql_user,
    )


def build_stats(atlas_db: Path, psql_user: str, retention_days: int) -> dict[str, object]:
    prune_activity_logs(retention_days, psql_user)

    registered_torn: set[str] = set()
    active_torn_7d: set[str] = set()
    active_torn_30d: set[str] = set()
    tools: list[dict[str, object]] = []

    for tool_id, definition in POSTGRES_TOOLS.items():
        database = str(definition["database"])
        registered = postgres_rows(database, str(definition["registered"]), psql_user)
        active_7d = postgres_rows(
            database, str(definition["active"]).format(days=7), psql_user
        )
        active_30d = postgres_rows(
            database, str(definition["active"]).format(days=30), psql_user
        )
        registered_torn.update(registered)
        active_torn_7d.update(active_7d)
        active_torn_30d.update(active_30d)
        tools.append(
            {
                "id": tool_id,
                "name": definition["name"],
                "registered": len(registered),
                "active7d": len(active_7d),
                "active30d": len(active_30d),
                "activitySource": "account",
            }
        )

    atlas = atlas_counts(atlas_db)
    tools.append(
        {
            "id": "tanothAtlas",
            "name": "Tanoth Atlas",
            **atlas,
            "activitySource": "account",
        }
    )
    race_stats = {
        "id": "raceStats",
        "name": "Race//Stats",
        "registered": None,
        "active7d": anonymous_activity("/racestats%", 7, psql_user),
        "active30d": anonymous_activity("/racestats%", 30, psql_user),
        "activitySource": "cookie-free visit estimate",
    }
    tools.append(race_stats)

    website_active_7d = anonymous_activity("/api/hub-activity", 7, psql_user)
    website_active_30d = anonymous_activity("/api/hub-activity", 30, psql_user)
    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "activeWindowDays": 30,
        "retentionDays": retention_days,
        "website": {
            "registered": None,
            "active7d": website_active_7d,
            "active30d": website_active_30d,
            "activitySource": "cookie-free visit estimate",
        },
        "webTools": {
            "registeredProfiles": len(registered_torn) + atlas["registered"],
            "activeProfiles7d": len(active_torn_7d) + atlas["active7d"],
            "activeProfiles30d": len(active_torn_30d) + atlas["active30d"],
            "tools": tools,
            "deduplication": "Torn IDs are deduplicated across Torn tools; Tanoth accounts are counted separately.",
        },
    }


def atomic_write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
    ) as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.chmod(0o644)
    os.replace(temporary, path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=Path("/var/lib/moduls-hub-usage/usage-stats.json")
    )
    parser.add_argument(
        "--atlas-db", type=Path, default=Path("/var/lib/tanoth-atlas/accounts.db")
    )
    parser.add_argument("--psql-user", default="postgres")
    parser.add_argument("--retention-days", type=int, default=90)
    arguments = parser.parse_args()
    if not 30 <= arguments.retention_days <= 365:
        raise ValueError("Retention must be between 30 and 365 days")
    payload = build_stats(arguments.atlas_db.resolve(), arguments.psql_user, arguments.retention_days)
    atomic_write_json(arguments.output.resolve(), payload)
    print(
        "Published aggregate usage stats: "
        f"{payload['webTools']['registeredProfiles']} registered profiles, "
        f"{payload['webTools']['activeProfiles30d']} active in 30 days"
    )


if __name__ == "__main__":
    main()
