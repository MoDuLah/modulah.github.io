import importlib.util
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[1] / "deploy" / "hub-usage-stats.py"
SPEC = importlib.util.spec_from_file_location("hub_usage_stats", MODULE_PATH)
hub_usage_stats = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(hub_usage_stats)


class HubUsageStatsTests(unittest.TestCase):
    def test_deduplicates_torn_profiles_and_keeps_tanoth_separate(self):
        registered = {
            "pp_licences": {"1", "2"},
            "jobcentreplus": {"2", "3"},
            "pit_guru": {"3", "4"},
            "landlord_ledger": {"4"},
        }
        active_7d = {
            "pp_licences": {"1"},
            "jobcentreplus": {"3"},
            "pit_guru": set(),
            "landlord_ledger": {"4"},
        }
        active_30d = {
            "pp_licences": {"1", "2"},
            "jobcentreplus": {"2", "3"},
            "pit_guru": {"4"},
            "landlord_ledger": {"4"},
        }

        def fake_rows(database, sql, _psql_user):
            if "7 days" in sql:
                return active_7d[database]
            if "30 days" in sql:
                return active_30d[database]
            return registered[database]

        def fake_anonymous(path_pattern, days, _psql_user):
            values = {
                ("/racestats%", 7): 5,
                ("/racestats%", 30): 8,
                ("/api/hub-activity", 7): 12,
                ("/api/hub-activity", 30): 20,
            }
            return values[(path_pattern, days)]

        with (
            mock.patch.object(hub_usage_stats, "postgres_rows", side_effect=fake_rows),
            mock.patch.object(hub_usage_stats, "anonymous_activity", side_effect=fake_anonymous),
            mock.patch.object(hub_usage_stats, "prune_activity_logs") as prune,
            mock.patch.object(
                hub_usage_stats,
                "atlas_counts",
                return_value={"registered": 1, "active7d": 1, "active30d": 1},
            ),
        ):
            payload = hub_usage_stats.build_stats(Path("accounts.db"), "postgres", 90)

        self.assertEqual(payload["website"]["active30d"], 20)
        self.assertEqual(payload["webTools"]["registeredProfiles"], 5)
        self.assertEqual(payload["webTools"]["activeProfiles7d"], 4)
        self.assertEqual(payload["webTools"]["activeProfiles30d"], 5)
        self.assertEqual(payload["webTools"]["tools"][-1]["registered"], None)
        self.assertEqual(payload["webTools"]["tools"][-1]["active30d"], 8)
        prune.assert_called_once_with(90, "postgres")


if __name__ == "__main__":
    unittest.main()
