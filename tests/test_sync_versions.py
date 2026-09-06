import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "sync-versions.py"
SPEC = importlib.util.spec_from_file_location("sync_versions", MODULE_PATH)
sync_versions = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = sync_versions
SPEC.loader.exec_module(sync_versions)


class SyncVersionsTests(unittest.TestCase):
    def test_standalone_version_headers_and_wrapped_bullets(self):
        notes = sync_versions.summarise_release_note(
            "Changelog\n2.5.2\n• Fixed the button after a\npage refresh.\n2.5.1\n• Older change.",
            "2.5.2",
        )
        self.assertEqual(notes, "Fixed the button after a page refresh.")

    @mock.patch.object(sync_versions, "fetch_json")
    def test_reads_version_dates_from_the_api(self, fetch_json):
        fetch_json.return_value = [{"version": "3.1.2", "created_at": "2026-09-06T22:51:34Z"}]
        self.assertEqual(sync_versions.fetch_greasyfork_history(580933, 20), [
            {"version": "3.1.2", "date": "2026-09-06"}
        ])
        self.assertIn("api.greasyfork.org", fetch_json.call_args.args[0])

    def test_backfills_releases_missed_between_checks(self):
        records = [{
            "id": "example", "title": "Example", "version": "1.2.0",
            "displayVersion": "v1.2.0", "date": "2026-09-06", "source": "greasyfork",
            "sourceUrl": "https://greasyfork.org/en/scripts/1",
            "_releaseNotes": {"v1.1.0": "Fixed an earlier issue."},
            "_releaseHistory": [{"version": "v1.1.0", "date": "2026-09-05"}],
        }]
        result = sync_versions.build_timeline(records, {}, [], [{"id": "example"}])
        self.assertEqual([item["version"] for item in result], ["v1.2.0", "v1.1.0"])
        self.assertEqual(result[1]["summary"], "Fixed an earlier issue.")
        self.assertEqual(sync_versions.build_timeline(records, {}, result, [{"id": "example"}]), result)

    def test_extracts_compact_summaries_from_greasyfork_changelogs(self):
        history = """
<ul class="history_versions">
  <li>
    <span class="version-number"><a>v2.3.4</a></span>
    <span class="version-changelog">
      <p>Failures now always produce one structured console.error containing:</p>
      <ul><li>Failure stage</li><li>Request URL</li><li>HTTP status</li></ul>
    </span>
  </li>
  <li>
    <span class="version-number"><a>v2.2.8</a></span>
    <span class="version-changelog"><p>/*<br>
      * 2.2.8 — settings are compact/collapsible, the status badge opens them,<br>
      * pool sharing uses an explicit switch, and completed sync messages return to Ready.<br>
      * ---------------------------------------------------------------------------<br>
      * 2.2.7 — older notes<br>*/</p></span>
  </li>
</ul>
"""
        notes = sync_versions.parse_greasyfork_release_notes(history)
        self.assertEqual(
            notes["2.3.4"],
            "Failures now always produce one structured console.error containing: Failure stage; Request URL; HTTP status.",
        )
        self.assertEqual(
            notes["2.2.8"],
            "Settings are compact/collapsible, the status badge opens them, pool sharing uses an explicit switch, and completed sync messages return to Ready.",
        )

    def test_extracts_only_userscript_target_hosts(self):
        code = """// ==UserScript==
// @name Example
// @version 1.0.0
// @match https://www.torn.com/page.php?sid=racing
// @match https://*.torn.com/loader.php*
// ==/UserScript==
"""
        self.assertEqual(
            sync_versions.extract_applies_to(code),
            [
                {
                    "name": "torn.com",
                    "url": "https://greasyfork.org/en/scripts/by-site/torn.com",
                }
            ],
        )

    def test_formats_greasyfork_sizes_like_the_script_page(self):
        self.assertEqual(sync_versions.format_size(26787), "26.2 KB")
        self.assertEqual(sync_versions.format_size(843402), "823.6 KB")

    @mock.patch.object(sync_versions, "fetch_text")
    @mock.patch.object(sync_versions, "fetch_json")
    def test_builds_marketplace_metadata(self, fetch_json, fetch_text):
        fetch_json.return_value = {
            "id": 563548,
            "version": "1.2.6",
            "daily_installs": 0,
            "total_installs": 63,
            "created_at": "2026-01-22T02:44:31Z",
            "code_updated_at": "2026-04-20T21:41:33Z",
            "code_size": 26787,
            "license": "MIT License",
            "code_url": "https://update.greasyfork.org/scripts/563548/example.user.js",
            "users": [
                {
                    "name": "MoDuL",
                    "url": "https://greasyfork.org/users/1561217-modul",
                }
            ],
        }
        fetch_text.side_effect = ["""// ==UserScript==
// @name Example
// @version 1.2.6
// @match https://www.torn.com/*
// ==/UserScript==
""", "<ul class=\"history_versions\"></ul>"]

        result = sync_versions.check_greasyfork({"scriptId": 563548}, 20)

        self.assertEqual(result.version, "1.2.6")
        self.assertEqual(result.marketplace["dailyInstalls"], 0)
        self.assertEqual(result.marketplace["totalInstalls"], 63)
        self.assertEqual(result.marketplace["createdDisplay"], "Jan 22, 2026")
        self.assertEqual(result.marketplace["updatedDisplay"], "Apr 20, 2026")
        self.assertEqual(result.marketplace["size"], "26.2 KB")
        self.assertEqual(result.marketplace["license"]["name"], "MIT")

    def test_writes_output_atomically(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "nested" / "updates.json"
            payload = {"schemaVersion": 1, "scripts": [], "errors": []}
            sync_versions.write_atomic(output, payload)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), payload)
            self.assertEqual(list(output.parent.glob("*.tmp")), [])

    def test_adds_and_deduplicates_version_timeline_events(self):
        records = [
            {
                "id": "cracked",
                "title": "cRaCked",
                "version": "2.3.0",
                "displayVersion": "v2.3.0",
                "date": "2026-08-25",
                "source": "greasyfork",
                "sourceUrl": "https://greasyfork.org/en/scripts/589397",
                "_releaseNotes": {
                    "v2.3.0": "Added a real public changelog for this release."
                },
            },
            {
                "id": "jobCentrePlus",
                "title": "JobCentre+",
                "version": "2.1.4",
                "displayVersion": "v2.1.4",
                "date": "2026-08-25",
                "source": "vm",
            },
        ]
        previous = {
            "cracked": {"version": "2.2.0", "displayVersion": "v2.2.0"},
            "jobCentrePlus": {"version": "2.1.3", "displayVersion": "v2.1.3"},
        }
        entries = [
            {"id": "cracked"},
            {
                "id": "jobCentrePlus",
                "timelineHref": "https://pp-api.sokin.xyz/jobcentreplus/",
            },
        ]

        timeline = sync_versions.build_timeline(records, previous, [], entries)

        self.assertEqual(len(timeline), 2)
        self.assertEqual(timeline[0]["version"], "v2.3.0")
        self.assertEqual(
            timeline[0]["summary"],
            "Added a real public changelog for this release.",
        )
        self.assertEqual("No changelog was published for this version.", timeline[1]["summary"])
        deduplicated = sync_versions.build_timeline(records, previous, timeline, entries)
        self.assertEqual(deduplicated, timeline)

    def test_backfills_generic_timeline_summaries_from_release_notes(self):
        records = [
            {
                "id": "cracked",
                "title": "cRaCked",
                "version": "2.4.0",
                "displayVersion": "v2.4.0",
                "date": "2026-08-28",
                "source": "greasyfork",
                "sourceUrl": "https://greasyfork.org/en/scripts/589397",
                "_releaseNotes": {
                    "v2.3.4": "Failures now include structured diagnostic details.",
                    "v2.4.0": "Fresh installs now present a clear privacy choice.",
                },
            }
        ]
        previous_timeline = [
            {
                "scriptId": "cracked",
                "title": "cRaCked",
                "version": "v2.3.4",
                "date": "2026-08-27",
                "type": "RELEASE",
                "summary": "GreasyFork published v2.3.4; the hub refreshed the card automatically.",
                "href": "https://greasyfork.org/en/scripts/589397",
            }
        ]

        timeline = sync_versions.build_timeline(
            records,
            {"cracked": {"version": "2.3.4"}},
            previous_timeline,
            [{"id": "cracked"}],
        )

        self.assertEqual(timeline[0]["summary"], "Fresh installs now present a clear privacy choice.")
        self.assertEqual(timeline[1]["summary"], "Failures now include structured diagnostic details.")

    def test_creates_a_current_baseline_without_duplicate_timeline_noise(self):
        records = [
            {
                "id": "raceThemeChanger",
                "title": "Race Theme Changer",
                "version": "1.2.6",
                "displayVersion": "v1.2.6",
                "date": "2026-04-20",
                "source": "greasyfork",
                "sourceUrl": "https://greasyfork.org/en/scripts/563548",
            }
        ]
        previous = {"raceThemeChanger": {"version": "1.2.6"}}
        entries = [{"id": "raceThemeChanger"}]
        baseline = sync_versions.build_timeline(records, previous, [], entries)
        self.assertEqual(len(baseline), 1)
        self.assertEqual("No changelog was published for this version.", baseline[0]["summary"])
        self.assertEqual(
            sync_versions.build_timeline(records, previous, baseline, entries),
            baseline,
        )

    def test_skips_sources_that_do_not_own_the_displayed_version(self):
        records = [
            {
                "id": "pitGuru",
                "title": "MoDuL's Pit Guru",
                "version": "2.2.9",
                "displayVersion": "v2.2.9",
                "date": "2026-07-15",
                "source": "greasyfork",
                "sourceUrl": "https://greasyfork.org/en/scripts/578342",
                "updateVersion": False,
            }
        ]
        self.assertEqual(
            sync_versions.build_timeline(records, {}, [], [{"id": "pitGuru"}]),
            [],
        )


if __name__ == "__main__":
    unittest.main()
