#!/usr/bin/env python3
"""Mirror a published GitHub Pages build; validate every byte before activation.

Only public files are downloaded. API routes and the live release feed remain
owned by Nginx and their existing services. The live release and one rollback
are retained after each successful synchronization.
"""

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import shutil
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath

SOURCE = "https://modulah.github.io/"
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_BYTES = 300 * 1024 * 1024
DEFAULT_RELEASES_TO_KEEP = 2


def fetch(path, limit):
    request = urllib.request.Request(
        SOURCE + urllib.parse.quote(path, safe="/"),
        headers={"User-Agent": "MoDuL-Hub-Mirror/1.0", "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        if urllib.parse.urlparse(response.url).netloc != "modulah.github.io":
            raise ValueError("Unexpected mirror redirect")
        body = response.read(limit + 1)
    if len(body) > limit:
        raise ValueError(f"File exceeds limit: {path}")
    return body


def validate_manifest(payload):
    if payload.get("schemaVersion") != 1 or not re.fullmatch(r"[0-9a-f]{40}", str(payload.get("revision", ""))):
        raise ValueError("Invalid publication revision")
    files = payload.get("files")
    if not isinstance(files, list) or not 1 <= len(files) <= 2000:
        raise ValueError("Invalid publication file list")
    names = set()
    total = 0
    for record in files:
        name = record.get("path", "")
        path = PurePosixPath(name)
        if not name or path.is_absolute() or str(path) != name or "\\" in name or any(part.startswith(".") for part in path.parts):
            raise ValueError("Unsafe publication path")
        if name in names or name == "site-files.json":
            raise ValueError("Duplicate publication path")
        names.add(name)
        size = record.get("size")
        if type(size) is not int or not 0 <= size <= MAX_FILE_BYTES:
            raise ValueError("Invalid publication file size")
        if not re.fullmatch(r"[0-9a-f]{64}", str(record.get("sha256", ""))):
            raise ValueError("Invalid file checksum")
        total += size
    if total > MAX_TOTAL_BYTES or not {"index.html", "assets/js/command-centre.js", "assets/data/module-screenshots.json"} <= names:
        raise ValueError("Incomplete or oversized publication")
    return files


def matches(path, record):
    return path.is_file() and not path.is_symlink() and path.stat().st_size == record["size"] and hashlib.sha256(path.read_bytes()).hexdigest() == record["sha256"]


def materialise(record, previous, stage):
    target = stage / record["path"]
    target.parent.mkdir(parents=True, exist_ok=True)
    existing = previous / record["path"]
    if previous in existing.resolve().parents and matches(existing, record):
        shutil.copyfile(existing, target)
    else:
        target.write_bytes(fetch(record["path"], record["size"]))
    if not matches(target, record):
        raise ValueError(f"Checksum mismatch: {record['path']}")
    target.chmod(0o644)


def prune_releases(releases, current, keep=DEFAULT_RELEASES_TO_KEEP):
    if keep < 2:
        raise ValueError("At least two releases are required for rollback")
    releases = releases.resolve()
    current = current.resolve()
    if not current.is_dir() or current.parent != releases:
        raise ValueError("The live release must be a direct child of the release root")

    candidates = []
    for candidate in releases.iterdir():
        if candidate.is_symlink() or not candidate.is_dir():
            continue
        resolved = candidate.resolve()
        if resolved != candidate or resolved.parent != releases:
            raise ValueError(f"Unsafe release directory: {candidate}")
        candidates.append(candidate)

    candidates.sort(key=lambda candidate: (candidate.stat().st_mtime_ns, candidate.name), reverse=True)
    retained = {current}
    for candidate in candidates:
        if len(retained) >= keep:
            break
        retained.add(candidate)

    removed = []
    for candidate in candidates:
        if candidate in retained:
            continue
        shutil.rmtree(candidate)
        removed.append(candidate)
    if removed:
        print(f"Pruned {len(removed)} stale release(s); retained {len(retained)}")
    return removed


def sync(root, releases_to_keep=DEFAULT_RELEASES_TO_KEEP):
    import fcntl
    root.mkdir(parents=True, exist_ok=True)
    with (root / ".sync.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        content = fetch("site-files.json", 1024 * 1024)
        payload = json.loads(content)
        files = validate_manifest(payload)
        current = root / "current"
        previous = current.resolve()
        if current.exists() and not current.is_symlink():
            raise ValueError("The live site must use a release symlink")
        releases = root / "releases"
        releases.mkdir(exist_ok=True)
        marker = previous / "site-files.json"
        if marker.is_file() and marker.read_bytes() == content:
            prune_releases(releases, previous, releases_to_keep)
            print(f"Already synchronized: {payload['revision']}")
            return
        stage = Path(tempfile.mkdtemp(prefix=f"sync-{payload['revision'][:12]}-", dir=releases))
        stage.chmod(0o755)
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
                list(pool.map(lambda record: materialise(record, previous, stage), files))
            (stage / "site-files.json").write_bytes(content)
            screenshots = json.loads((stage / "assets/data/module-screenshots.json").read_text())
            for gallery in screenshots["modules"].values():
                for shot in gallery:
                    if shot["src"] not in {record["path"] for record in files}:
                        raise ValueError("Gallery references an unpublished image")
            # The source must still advertise exactly the build we just verified.
            if fetch("site-files.json", 1024 * 1024) != content:
                raise ValueError("Publication changed during synchronization; retry next run")
            link = root / ".current-next"
            if link.exists() or link.is_symlink():
                link.unlink()
            link.symlink_to(stage, target_is_directory=True)
            os.replace(link, current)
            print(f"Activated {payload['revision']}: {len(files)} verified files. Rollback: {previous}")
            prune_releases(releases, stage, releases_to_keep)
        except Exception:
            # A failed stage is never live and repeated timer retries must not
            # accumulate partial releases on the production filesystem.
            shutil.rmtree(stage, ignore_errors=True)
            print(f"Synchronization failed; staging removed: {stage}")
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/var/www/moduls-hub"))
    parser.add_argument("--keep-releases", type=int, default=DEFAULT_RELEASES_TO_KEEP)
    arguments = parser.parse_args()
    sync(arguments.root.resolve(), arguments.keep_releases)
