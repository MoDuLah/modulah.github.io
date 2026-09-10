#!/usr/bin/env python3
"""Build the MoDuL Hub runtime script-version manifest.

The command centre keeps editorial descriptions in its static catalogue. This
checker synchronises authoritative machine-readable fields, imports public
GreasyFork changelogs, and maintains a deduplicated script-release timeline.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
DEFAULT_TIMEOUT_SECONDS = 20
MAX_TIMELINE_EVENTS = 50
USER_AGENT = "MoDuL-Hub-Update-Checker/1.0"
VERSION_PATTERN = re.compile(r"^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$")
METADATA_PATTERN = re.compile(
    r"^//\s+@(?P<key>[A-Za-z][A-Za-z0-9_-]*)\s+(?P<value>.*?)\s*$",
    re.MULTILINE,
)


class UpdateCheckError(RuntimeError):
    """Raised when an authoritative update source cannot be validated."""


@dataclass(frozen=True)
class SourceResult:
    version: str
    date: str
    updated: str
    source: str
    source_url: str | None = None
    marketplace: dict[str, Any] | None = None
    release_notes: dict[str, str] | None = None
    release_history: list[dict[str, str]] | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("config/script-update-sources.json"),
        help="Source manifest JSON.",
    )
    parser.add_argument(
        "--site-root",
        type=Path,
        default=Path.cwd(),
        help="Static-site root used for relative userscript paths.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/data/script-updates.json"),
        help="Generated runtime JSON path.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="Per-request timeout in seconds.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Atomically replace the output file after every required source passes.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, json.JSONDecodeError) as error:
        raise UpdateCheckError(f"Could not read JSON config: {path}") from error
    if not isinstance(value, dict):
        raise UpdateCheckError(f"Expected a JSON object in {path}")
    return value


def load_previous(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}
    scripts = payload.get("scripts", []) if isinstance(payload, dict) else []
    if not isinstance(scripts, list):
        return {}
    return {
        item["id"]: item
        for item in scripts
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }


def is_safe_timeline_href(value: Any) -> bool:
    href = str(value or "").strip()
    if href.startswith(("https://greasyfork.org/", "https://pp-api.sokin.xyz/")):
        return len(href) <= 300
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_./-]{0,199}", href):
        return False
    return ".." not in Path(href).parts


def normalise_timeline_event(value: Any) -> dict[str, str] | None:
    if not isinstance(value, dict):
        return None
    script_id = value.get("scriptId")
    title = value.get("title")
    version = value.get("version")
    date = value.get("date")
    event_type = value.get("type")
    summary = value.get("summary")
    href = value.get("href")
    if not isinstance(script_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", script_id):
        return None
    if not isinstance(title, str) or not 1 <= len(title) <= 140:
        return None
    if not isinstance(version, str) or not VERSION_PATTERN.fullmatch(version):
        return None
    if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        return None
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return None
    if event_type not in {"RELEASE", "HOTFIX"}:
        return None
    if not isinstance(summary, str) or not 1 <= len(summary) <= 360:
        return None
    if not is_safe_timeline_href(href):
        return None
    return {
        "scriptId": script_id,
        "title": title,
        "version": version,
        "date": date,
        "type": event_type,
        "summary": summary,
        "href": str(href),
    }


def load_previous_timeline(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []
    timeline = payload.get("timeline", []) if isinstance(payload, dict) else []
    if not isinstance(timeline, list):
        return []
    return [
        event
        for item in timeline
        if (event := normalise_timeline_event(item)) is not None
    ][:MAX_TIMELINE_EVENTS]


def validate_version(value: Any, source_name: str) -> str:
    version = str(value or "").strip()
    if not VERSION_PATTERN.fullmatch(version):
        raise UpdateCheckError(f"{source_name} returned an invalid version")
    return version


def iso_date(value: str, source_name: str) -> str:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as error:
        raise UpdateCheckError(f"{source_name} returned an invalid update date") from error
    return parsed.astimezone(timezone.utc).date().isoformat()


def human_date(value: str) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d")
    return f"{parsed.day} {parsed.strftime('%B %Y')}"


def marketplace_date(value: str) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d")
    return f"{parsed.strftime('%b')} {parsed.day}, {parsed.year}"


def format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"


def format_display_version(version: str, prefix: str) -> str:
    return version if not prefix or version.startswith(prefix) else f"{prefix}{version}"


def fetch_json(url: str, timeout: int) -> Any:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.load(response)
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
        raise UpdateCheckError("GreasyFork request failed") from error
    if not isinstance(payload, (dict, list)):
        raise UpdateCheckError("GreasyFork returned an invalid response")
    return payload


def fetch_text(url: str, timeout: int) -> str:
    request = urllib.request.Request(
        url,
        headers={"Accept": "text/html, text/javascript, text/plain", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except (OSError, urllib.error.URLError, UnicodeError) as error:
        raise UpdateCheckError("GreasyFork text request failed") from error


class GreasyForkChangelogParser(HTMLParser):
    """Collect version labels and their changelog HTML from a history page."""

    BLOCK_TAGS = {"br", "h1", "h2", "h3", "h4", "li", "p"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.version_depth = 0
        self.changelog_depth = 0
        self.version_parts: list[str] = []
        self.changelog_parts: list[str] = []
        self.current_version = ""
        self.release_notes: dict[str, str] = {}

    @staticmethod
    def _classes(attributes: list[tuple[str, str | None]]) -> set[str]:
        raw = next((value or "" for key, value in attributes if key == "class"), "")
        return set(raw.split())

    def handle_starttag(
        self,
        tag: str,
        attributes: list[tuple[str, str | None]],
    ) -> None:
        classes = self._classes(attributes)
        if self.version_depth and tag == "span":
            self.version_depth += 1
        elif tag == "span" and "version-number" in classes:
            self.version_depth = 1
            self.version_parts = []

        if self.changelog_depth:
            if tag == "span":
                self.changelog_depth += 1
            if tag in self.BLOCK_TAGS:
                self.changelog_parts.append("\n")
            if tag == "li":
                self.changelog_parts.append("• ")
        elif tag == "span" and "version-changelog" in classes:
            self.changelog_depth = 1
            self.changelog_parts = []

    def handle_endtag(self, tag: str) -> None:
        if self.version_depth and tag == "span":
            self.version_depth -= 1
            if not self.version_depth:
                self.current_version = "".join(self.version_parts).strip().removeprefix("v")

        if self.changelog_depth:
            if tag in self.BLOCK_TAGS and tag != "br":
                self.changelog_parts.append("\n")
            if tag == "span":
                self.changelog_depth -= 1
                if not self.changelog_depth and self.current_version:
                    raw_note = "".join(self.changelog_parts)
                    summary = summarise_release_note(raw_note, self.current_version)
                    if summary:
                        self.release_notes[self.current_version] = summary

    def handle_data(self, data: str) -> None:
        if self.version_depth:
            self.version_parts.append(data)
        if self.changelog_depth:
            self.changelog_parts.append(re.sub(r"[^\S\n]+", " ", data))


def _clean_release_line(value: str) -> str:
    line = value.strip()
    line = re.sub(r"^#{1,6}\s+", "", line)
    line = re.sub(r"^[-+]\s+", "• ", line)
    line = re.sub(r"^/\*+\s*", "", line)
    line = re.sub(r"^\*+\s?", "", line)
    line = re.sub(r"\s*\*/$", "", line)
    return re.sub(r"\s+", " ", line).strip()


def _release_note_segments(lines: list[str]) -> list[str]:
    segments: list[str] = []
    paragraph: list[str] = []

    def flush_paragraph() -> None:
        if paragraph:
            segments.append(" ".join(paragraph))
            paragraph.clear()

    for line in lines:
        if not line:
            flush_paragraph()
            continue
        if line.startswith("• "):
            flush_paragraph()
            paragraph.append(line[2:].strip())
            continue
        paragraph.append(line)
    flush_paragraph()
    return [segment for segment in segments if segment]


def _limit_release_summary(value: str, maximum: int = 360) -> str:
    summary = re.sub(r"\s+", " ", value).strip()
    if len(summary) <= maximum:
        return summary
    punctuation_boundary = max(
        summary.rfind(". ", 0, maximum - 1),
        summary.rfind("; ", 0, maximum - 1),
    )
    if punctuation_boundary >= maximum // 2:
        return f"{summary[:punctuation_boundary + 1].rstrip(' ;')}…"
    boundary = summary.rfind(" ", 0, maximum - 1)
    if boundary < maximum // 2:
        boundary = maximum - 1
    return f"{summary[:boundary].rstrip(' ,;:.')}…"


def summarise_release_note(raw_note: str, version: str) -> str:
    """Turn one GreasyFork changelog block into a compact timeline summary."""

    lines = [_clean_release_line(line) for line in raw_note.splitlines()]
    target = re.escape(version.removeprefix("v"))
    version_marker = re.compile(
        rf"^v?{target}(?:\s*[—–-]\s*(?P<note>.*))?$",
        re.IGNORECASE,
    )
    any_version_marker = re.compile(r"^v?\d+(?:\.\d+)+(?:\s*[—–-]\s*.*)?$", re.IGNORECASE)
    separator = re.compile(r"^-{5,}$")
    selected: list[str] = []
    found_marker = False

    for index, line in enumerate(lines):
        match = version_marker.match(line)
        if not match:
            continue
        found_marker = True
        selected.append((match.group("note") or "").strip())
        for continuation in lines[index + 1 :]:
            if separator.fullmatch(continuation) or any_version_marker.match(continuation):
                break
            selected.append(continuation)
        break

    if not found_marker:
        selected = lines
    else:
        selected = [line for line in selected if line]

    selected = [line for line in selected if not separator.fullmatch(line)]
    segments = _release_note_segments(selected)
    if not segments:
        return ""

    first = segments[0].strip()
    if found_marker and first:
        first = f"{first[0].upper()}{first[1:]}"
    rest = [segment.rstrip(" .;:") for segment in segments[1:] if segment.rstrip(" .;:")]
    if rest:
        if found_marker and first and first[-1] not in ".!?;:":
            first = f"{first}:"
        if first.endswith(":"):
            summary = f"{first} {'; '.join(rest)}."
        else:
            summary = f"{first.rstrip(' .;')} — {'; '.join(rest)}."
    else:
        summary = first
        if summary and summary[-1] not in ".!?…":
            summary += "."
    return _limit_release_summary(summary)


def parse_greasyfork_release_notes(content: str) -> dict[str, str]:
    parser = GreasyForkChangelogParser()
    parser.feed(content)
    parser.close()
    return parser.release_notes


def fetch_greasyfork_release_notes(script_id: int, timeout: int) -> dict[str, str]:
    history_url = (
        f"https://greasyfork.org/en/scripts/{script_id}/versions?show_all_versions=1&list_all=1"
    )
    try:
        return parse_greasyfork_release_notes(fetch_text(history_url, timeout))
    except UpdateCheckError:
        # Changelogs are an enhancement. A temporary history-page failure must
        # not prevent authoritative versions and marketplace data from updating.
        return {}


def fetch_greasyfork_history(script_id: int, timeout: int) -> list[dict[str, str]]:
    """The JSON API supplies version dates; changelog text comes from HTML."""
    url = f"https://api.greasyfork.org/en/scripts/{script_id}/versions.json?show_all_versions=1"
    try:
        payload = fetch_json(url, timeout)
        if not isinstance(payload, list):
            return []
        return [
            {
                "version": validate_version(item.get("version"), "GreasyFork history"),
                "date": iso_date(item.get("created_at", ""), "GreasyFork history"),
            }
            for item in payload[:MAX_TIMELINE_EVENTS]
            if isinstance(item, dict)
        ]
    except UpdateCheckError:
        return []


def safe_nonnegative_int(value: Any, source_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise UpdateCheckError(f"{source_name} returned an invalid count")
    return value


def parse_metadata_values(content: str) -> dict[str, list[str]]:
    metadata: dict[str, list[str]] = {}
    for match in METADATA_PATTERN.finditer(content):
        metadata.setdefault(match.group("key").lower(), []).append(
            match.group("value").strip()
        )
    return metadata


def extract_applies_to(content: str) -> list[dict[str, str]]:
    metadata = parse_metadata_values(content)
    patterns = metadata.get("match", []) + metadata.get("include", [])
    domains: set[str] = set()
    for pattern in patterns:
        match = re.match(r"^(?:\*|https?|ftp)://(?P<host>[^/]+)", pattern)
        if not match:
            continue
        domain = match.group("host").split(":", 1)[0].removeprefix("*.")
        normalised = domain.lower().removeprefix("www.")
        if not re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)+", normalised):
            continue
        if normalised.endswith(".torn.com"):
            normalised = "torn.com"
        elif normalised.endswith(".tornpda.com"):
            normalised = "tornpda.com"
        domains.add(normalised)
    return [
        {
            "name": domain,
            "url": f"https://greasyfork.org/en/scripts/by-site/{domain}",
        }
        for domain in sorted(domains)
    ]


def normalise_license(value: Any) -> dict[str, str]:
    raw = str(value or "Unspecified").strip() or "Unspecified"
    known = {
        "MIT License": ("MIT", "https://spdx.org/licenses/MIT.html"),
        "GNU GPLv3": (
            "GPL-3.0-only",
            "https://spdx.org/licenses/GPL-3.0-only.html",
        ),
        "GNU General Public License v3.0 or later": (
            "GPL-3.0-or-later",
            "https://spdx.org/licenses/GPL-3.0-or-later.html",
        ),
    }
    name, url = known.get(raw, (raw, ""))
    result = {"name": name}
    if url:
        result["url"] = url
    return result


def check_greasyfork(source: dict[str, Any], timeout: int) -> SourceResult:
    script_id = source.get("scriptId")
    if not isinstance(script_id, int) or script_id <= 0:
        raise UpdateCheckError("GreasyFork scriptId must be a positive integer")
    api_url = f"https://api.greasyfork.org/en/scripts/{script_id}.json"
    payload = fetch_json(api_url, timeout)
    if not isinstance(payload, dict) or payload.get("id") != script_id:
        raise UpdateCheckError("GreasyFork returned the wrong script")
    version = validate_version(payload.get("version"), f"GreasyFork script {script_id}")
    date = iso_date(payload.get("code_updated_at", ""), f"GreasyFork script {script_id}")
    created = iso_date(payload.get("created_at", ""), f"GreasyFork script {script_id}")
    daily_installs = safe_nonnegative_int(
        payload.get("daily_installs"),
        f"GreasyFork script {script_id}",
    )
    total_installs = safe_nonnegative_int(
        payload.get("total_installs"),
        f"GreasyFork script {script_id}",
    )
    size_bytes = safe_nonnegative_int(
        payload.get("code_size"),
        f"GreasyFork script {script_id}",
    )
    users = payload.get("users")
    if not isinstance(users, list) or not users or not isinstance(users[0], dict):
        raise UpdateCheckError(f"GreasyFork script {script_id} has no author")
    author_name = str(users[0].get("name") or "").strip()
    author_url = str(users[0].get("url") or "").strip()
    if not author_name or not author_url.startswith("https://greasyfork.org/"):
        raise UpdateCheckError(f"GreasyFork script {script_id} has invalid author data")
    code_url = str(payload.get("code_url") or "").strip()
    if not code_url.startswith(f"https://update.greasyfork.org/scripts/{script_id}/"):
        raise UpdateCheckError(f"GreasyFork script {script_id} has an invalid code URL")
    applies_to = extract_applies_to(fetch_text(code_url, timeout))
    if not applies_to:
        raise UpdateCheckError(f"GreasyFork script {script_id} has no target sites")
    marketplace = {
        "author": {"name": author_name, "url": author_url},
        "dailyInstalls": daily_installs,
        "totalInstalls": total_installs,
        "version": version,
        "created": created,
        "createdDisplay": marketplace_date(created),
        "updated": date,
        "updatedDisplay": marketplace_date(date),
        "sizeBytes": size_bytes,
        "size": format_size(size_bytes),
        "license": normalise_license(payload.get("license")),
        "appliesTo": applies_to,
    }
    return SourceResult(
        version=version,
        date=date,
        updated=human_date(date),
        source="greasyfork",
        source_url=f"https://greasyfork.org/en/scripts/{script_id}",
        marketplace=marketplace,
        release_notes=fetch_greasyfork_release_notes(script_id, timeout),
        release_history=fetch_greasyfork_history(script_id, timeout),
    )


def parse_userscript_metadata(path: Path) -> dict[str, str]:
    try:
        content = path.read_text(encoding="utf-8-sig")
    except OSError as error:
        raise UpdateCheckError("Userscript file is unavailable") from error
    values = parse_metadata_values(content)
    metadata = {key: entries[-1] for key, entries in values.items() if entries}
    if "version" not in metadata or "name" not in metadata:
        raise UpdateCheckError("Userscript metadata is incomplete")
    return metadata


def expand_source_path(raw_path: str, site_root: Path) -> Path:
    expanded = os.path.expandvars(raw_path)
    if "$" in expanded:
        raise UpdateCheckError("A userscript path environment variable is unset")
    path = Path(expanded)
    if not path.is_absolute():
        path = site_root / path
    return path.resolve()


def check_userscript(
    entry: dict[str, Any],
    source: dict[str, Any],
    site_root: Path,
    previous: dict[str, Any] | None,
    today: str,
) -> SourceResult:
    raw_path = source.get("path")
    if not isinstance(raw_path, str) or not raw_path.strip():
        raise UpdateCheckError("Userscript source path is missing")
    metadata = parse_userscript_metadata(expand_source_path(raw_path, site_root))
    version = validate_version(metadata.get("version"), entry["id"])
    previous_version = str((previous or {}).get("version", ""))
    previous_date = str((previous or {}).get("date", ""))
    if previous_version == version and re.fullmatch(r"\d{4}-\d{2}-\d{2}", previous_date):
        date = previous_date
    elif not previous and re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(entry.get("initialDate", ""))):
        date = str(entry["initialDate"])
    else:
        date = today
    return SourceResult(
        version=version,
        date=date,
        updated=human_date(date),
        source="userscript",
    )


def build_record(
    entry: dict[str, Any],
    site_root: Path,
    previous: dict[str, Any] | None,
    today: str,
    timeout: int,
) -> dict[str, Any]:
    entry_id = entry.get("id")
    title = entry.get("title")
    source = entry.get("source")
    if not isinstance(entry_id, str) or not entry_id:
        raise UpdateCheckError("Every source entry requires an id")
    if not isinstance(title, str) or not title:
        raise UpdateCheckError(f"{entry_id} requires a title")
    if not isinstance(source, dict):
        raise UpdateCheckError(f"{entry_id} requires a source object")

    source_type = source.get("type")
    if source_type == "greasyfork":
        result = check_greasyfork(source, timeout)
    elif source_type == "userscript":
        result = check_userscript(entry, source, site_root, previous, today)
    else:
        raise UpdateCheckError(f"{entry_id} has an unsupported source type")

    display_version = format_display_version(
        result.version,
        str(entry.get("displayPrefix", "")),
    )
    record: dict[str, Any] = {
        "id": entry_id,
        "title": title,
        "version": result.version,
        "displayVersion": display_version,
        "date": result.date,
        "updated": result.updated,
        "source": result.source,
        "updateVersion": entry.get("updateVersion", True) is not False,
    }
    action_template = entry.get("actionLabelTemplate")
    if isinstance(action_template, str) and "{version}" in action_template:
        record["actionLabel"] = action_template.format(version=display_version)
    if result.source_url:
        record["sourceUrl"] = result.source_url
    if result.marketplace:
        record["marketplace"] = result.marketplace
    if result.release_notes:
        record["_releaseNotes"] = {
            format_display_version(version, str(entry.get("displayPrefix", ""))): summary
            for version, summary in result.release_notes.items()
        }
    if result.release_history:
        record["_releaseHistory"] = [
            {**item, "version": format_display_version(item["version"], str(entry.get("displayPrefix", "")))}
            for item in result.release_history
        ]
    return record


def release_note_for(record: dict[str, Any], display_version: str) -> str:
    notes = record.get("_releaseNotes")
    if not isinstance(notes, dict):
        return ""
    wanted = display_version.casefold()
    return next(
        (
            summary
            for version, summary in notes.items()
            if isinstance(version, str)
            and version.casefold() == wanted
            and isinstance(summary, str)
        ),
        "",
    )


def build_timeline(
    records: list[dict[str, Any]],
    previous: dict[str, dict[str, Any]],
    previous_timeline: list[dict[str, str]],
    entries: list[dict[str, Any]],
) -> list[dict[str, str]]:
    entries_by_id = {
        entry.get("id"): entry
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("id"), str)
    }
    records_by_id = {
        record["id"].casefold(): record
        for record in records
        if isinstance(record.get("id"), str)
    }
    enriched_previous: list[dict[str, str]] = []
    for event in previous_timeline:
        record = records_by_id.get(event["scriptId"].casefold())
        note = release_note_for(record, event["version"]) if record else ""
        generic = re.search(r"hub (?:refreshed|keeps)|Current VM-hosted", event["summary"])
        summary = note or ("No changelog was published for this version." if generic else event["summary"])
        href = f"{record['sourceUrl']}/versions" if record and record.get("source") == "greasyfork" else event["href"]
        enriched_previous.append({**event, "summary": summary, "href": href})

    # Backfill version-specific notes, including releases between updater runs.
    for record in records:
        if record.get("updateVersion") is False:
            continue
        for release in record.get("_releaseHistory", []):
            note = release_note_for(record, release["version"])
            if not note:
                continue
            enriched_previous.append({
                "scriptId": record["id"], "title": record["title"],
                "version": release["version"], "date": release["date"],
                "type": "RELEASE", "summary": note,
                "href": f"{record['sourceUrl']}/versions",
            })

    existing_pairs = {
        (event["scriptId"].casefold(), event["version"].casefold())
        for event in enriched_previous
    }
    new_events: list[dict[str, str]] = []
    for record in records:
        script_id = record["id"]
        entry = entries_by_id.get(script_id, {})
        if record.get("updateVersion") is False:
            continue
        event_pair = (script_id.casefold(), record["displayVersion"].casefold())
        if event_pair in existing_pairs:
            continue
        href = record.get("sourceUrl") or entry.get("timelineHref")
        if record["source"] == "greasyfork":
            href = f"{href}/versions"
        if not is_safe_timeline_href(href):
            continue
        release_note = release_note_for(record, record["displayVersion"])
        summary = release_note or "No changelog was published for this version."
        event = normalise_timeline_event(
            {
                "scriptId": script_id,
                "title": record["title"],
                "version": record["displayVersion"],
                "date": record["date"],
                "type": "RELEASE",
                "summary": summary,
                "href": href,
            }
        )
        if event:
            new_events.append(event)

    combined = new_events + enriched_previous
    unique: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for event in combined:
        normalised = normalise_timeline_event(event)
        if not normalised:
            continue
        key = (normalised["scriptId"].casefold(), normalised["version"].casefold())
        if key in seen:
            continue
        seen.add(key)
        unique.append(normalised)
    # Dates have day precision: same-day versions must not retain insertion order.
    def release_order(event):
        version = tuple(
            (1, int(part)) if part.isdigit() else (0, part.casefold())
            for part in re.findall(r"\d+|\D+", event["version"])
        )
        return event["date"], event.get("scriptId") or event["title"].casefold(), version

    return sorted(unique, key=release_order, reverse=True)[:MAX_TIMELINE_EVENTS]


def write_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary_path, 0o644)
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def main() -> int:
    args = parse_args()
    config = load_json(args.config)
    entries = config.get("scripts")
    if not isinstance(entries, list) or not entries:
        raise UpdateCheckError("Config scripts must be a non-empty array")

    output = args.output.resolve()
    previous = load_previous(output)
    previous_timeline = load_previous_timeline(output)
    checked_at = datetime.now(timezone.utc)
    today = checked_at.date().isoformat()
    records: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    for entry in entries:
        entry_id = entry.get("id", "unknown") if isinstance(entry, dict) else "unknown"
        try:
            if not isinstance(entry, dict):
                raise UpdateCheckError("Source entry must be an object")
            records.append(
                build_record(
                    entry,
                    args.site_root.resolve(),
                    previous.get(entry_id),
                    today,
                    args.timeout,
                )
            )
        except UpdateCheckError as error:
            failure = {"id": str(entry_id), "error": str(error)}
            if isinstance(entry, dict) and entry.get("required", True) is False:
                warnings.append(failure)
                if entry_id in previous:
                    records.append(previous[entry_id])
            else:
                errors.append(failure)

    timeline = build_timeline(records, previous, previous_timeline, entries)
    public_records = [
        {key: value for key, value in record.items() if not key.startswith("_")}
        for record in records
    ]
    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "checkedAt": checked_at.isoformat().replace("+00:00", "Z"),
        "scripts": public_records,
        "timeline": timeline,
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))

    if errors:
        print("Required update sources failed; output was not replaced.", file=sys.stderr)
        return 1
    if args.write:
        write_atomic(output, payload)
        print(f"Wrote {len(records)} checked versions.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except UpdateCheckError as error:
        print(f"Update checker failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
