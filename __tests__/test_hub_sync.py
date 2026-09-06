"""Deployment contract tests: bad builds cannot replace the live release."""

import hashlib
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("hub_sync", Path(__file__).resolve().parents[1] / "deploy/sync-hub.py")
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)


class MirrorTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.files = {
            "index.html": b"<h1>Shared hub</h1>",
            "assets/js/command-centre.js": b"// shared app",
            "assets/data/module-screenshots.json": b'{"modules": {"pythagoras": []}}',
        }
        self.payload = {"schemaVersion": 1, "revision": "a" * 40, "files": [
            {"path": name, "size": len(content), "sha256": hashlib.sha256(content).hexdigest()}
            for name, content in self.files.items()
        ]}

    def test_path_traversal_rejected(self):
        for name in ("../outside", "/etc/passwd", "assets/../../outside", "assets\\outside", ".git/config"):
            with self.subTest(name=name):
                self.payload["files"][0]["path"] = name
                with self.assertRaises(ValueError):
                    mirror.validate_manifest(self.payload)

    def test_corrupt_download_rejected(self):
        with patch.object(mirror, "fetch", return_value=b"corrupt"):
            with self.assertRaisesRegex(ValueError, "Checksum mismatch"):
                mirror.materialise(self.payload["files"][0], self.root / "old", self.root / "stage")

    def test_identical_file_reused_without_request(self):
        previous = self.root / "old"
        previous.mkdir()
        (previous / "index.html").write_bytes(self.files["index.html"])
        with patch.object(mirror, "fetch") as fetch:
            mirror.materialise(self.payload["files"][0], previous, self.root / "stage")
            fetch.assert_not_called()
        self.assertEqual((self.root / "stage/index.html").read_bytes(), self.files["index.html"])

    @unittest.skipIf(os.name == "nt", "Release activation uses POSIX symlinks and locking")
    def test_activation_and_failure_preserve_previous_release(self):
        previous = self.root / "releases/old"
        previous.mkdir(parents=True)
        (previous / "index.html").write_text("old version")
        (self.root / "current").symlink_to(previous)
        def fetch(name, limit):
            return json.dumps(self.payload).encode() if name == "site-files.json" else self.files[name]
        with patch.object(mirror, "fetch", side_effect=fetch):
            mirror.sync(self.root)
            live = (self.root / "current").resolve()
            self.assertNotEqual(live, previous)
            self.assertEqual((previous / "index.html").read_text(), "old version")
            mirror.sync(self.root)
            self.assertEqual((self.root / "current").resolve(), live)
            self.payload["revision"] = "b" * 40
            self.payload["files"][0]["sha256"] = hashlib.sha256(b"new version").hexdigest()
            self.payload["files"][0]["size"] = len(b"new version")
            self.files["index.html"] = b"corrupt"
            with self.assertRaisesRegex(ValueError, "Checksum mismatch"):
                mirror.sync(self.root)
            self.assertEqual((self.root / "current").resolve(), live)


if __name__ == "__main__":
    unittest.main()
