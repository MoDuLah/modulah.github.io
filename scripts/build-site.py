#!/usr/bin/env python3
"""Package the public hub once, with a checksum manifest for the VM mirror."""

import argparse
import hashlib
import json
import shutil
import subprocess
import urllib.request
from pathlib import Path

PUBLIC_DIRECTORIES = {
    "assets", "banners", "Agar.io", "bounty_ledger", "cr4ck3d",
    "custom-race-filter", "eggsterminator", "global-theme",
    "landlord-tenant-ledger", "lap-recorder", "pages", "pit-guru",
    "pythagoras-project-cis", "race-theme-changer", "race-tracker",
    "restore-og-names", "smuggler", "stock-x", "tornfolio", "jobcentre-plus",
}
PUBLIC_FILES = {"index.html", "favicon.png", "shader.html", "torn_racing_visual_upgrade_demo.html"}
EXTENSIONS = {".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".txt", ".zip", ".woff", ".woff2"}


def build(root, output):
    if output.exists():
        raise ValueError("Use a new output directory for each build")
    # Carry the VM's accumulated history into the published offline fallback.
    try:
        request = urllib.request.Request("https://pp-api.sokin.xyz/assets/data/script-updates.json", headers={"User-Agent": "MoDuL-Hub-Build/1.0"})
        with urllib.request.urlopen(request, timeout=20) as response:
            snapshot = json.load(response)
        if snapshot.get("schemaVersion") != 1 or not isinstance(snapshot.get("scripts"), list) or not isinstance(snapshot.get("timeline"), list):
            raise ValueError("Invalid release snapshot")
        (root / "assets/data/script-updates.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError) as error:
        print(f"Live feed unavailable; retaining the saved release snapshot ({type(error).__name__})")
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
    files = {
        name for name in tracked if name and (
            name in PUBLIC_FILES or (
                Path(name).parts[0] in PUBLIC_DIRECTORIES
                and Path(name).suffix.lower() in EXTENSIONS
            )
        )
    }
    files.update({"assets/data/module-screenshots.json", "assets/data/script-updates.json"})
    output.mkdir(parents=True)
    manifest = []
    for name in sorted(files):
        source = root / name
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Missing or unsafe public file: {name}")
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        content = target.read_bytes()
        manifest.append({"path": name, "size": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    (output / ".nojekyll").touch()
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    payload = {"schemaVersion": 1, "revision": revision, "files": manifest}
    (output / "site-files.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(manifest)} public files from {revision}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(Path.cwd(), args.output.resolve())
