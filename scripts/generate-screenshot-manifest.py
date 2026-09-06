#!/usr/bin/env python3
"""Discover numbered module screenshots and write the public gallery manifest."""

from __future__ import annotations

import argparse
import json
import re
import tempfile
from pathlib import Path
from typing import Any


IMAGE_PATTERN = re.compile(r"^screenshot-(?P<number>\d+)\.(?P<extension>gif|jpe?g|png|webp)$", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-root", type=Path, default=Path.cwd())
    parser.add_argument("--config", type=Path, default=Path("config/module-screenshot-sources.json"))
    parser.add_argument("--output", type=Path, default=Path("assets/data/module-screenshots.json"))
    parser.add_argument("--write", action="store_true")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path}")
    return value


def safe_relative_asset(site_root: Path, relative_path: str) -> str:
    asset_root = (site_root / "assets" / "images").resolve()
    candidate = (asset_root / relative_path).resolve()
    if asset_root not in candidate.parents or not candidate.is_file():
        raise ValueError(f"Screenshot asset is missing or outside assets/images: {relative_path}")
    return candidate.relative_to(site_root).as_posix()


def discover_module(site_root: Path, module_id: str, source: dict[str, Any]) -> list[dict[str, str]]:
    paths: list[tuple[int, str]] = []
    directory = source.get("directory")
    if isinstance(directory, str) and re.fullmatch(r"[A-Za-z0-9_-]+", directory):
        folder = site_root / "assets" / "images" / directory
        if folder.is_dir():
            for path in folder.iterdir():
                match = IMAGE_PATTERN.fullmatch(path.name)
                if match and path.is_file():
                    paths.append((int(match.group("number")), f"{directory}/{path.name}"))

    files = source.get("files", [])
    if isinstance(files, list):
        for relative_path in files:
            if not isinstance(relative_path, str):
                continue
            paths.append((len(paths) + 1, relative_path))

    title = str(source.get("title") or module_id)
    seen: set[str] = set()
    screenshots: list[dict[str, str]] = []
    for index, relative_path in sorted(paths, key=lambda item: (item[0], item[1])):
        src = safe_relative_asset(site_root, relative_path)
        if src in seen:
            continue
        seen.add(src)
        filename = Path(relative_path).stem
        label = f"{title} screenshot {index}" if filename.startswith("screenshot-") else f"{title} preview"
        screenshots.append({"src": src, "alt": label})
    return screenshots


def build_payload(site_root: Path, config: dict[str, Any]) -> dict[str, Any]:
    modules = config.get("modules")
    if not isinstance(modules, dict):
        raise ValueError("Config modules must be an object")
    return {
        "schemaVersion": 1,
        "modules": {
            module_id: discover_module(site_root, module_id, source)
            for module_id, source in modules.items()
            if isinstance(module_id, str) and isinstance(source, dict)
        },
    }


def write_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary_path = Path(temporary_name)
    try:
        with open(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def main() -> int:
    args = parse_args()
    site_root = args.site_root.resolve()
    payload = build_payload(site_root, load_json((site_root / args.config).resolve()))
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    if args.write:
        write_atomic((site_root / args.output).resolve(), payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
