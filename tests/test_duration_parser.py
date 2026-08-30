import unittest
import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import format_duration, format_time_saved


class TestDurationFormatter(unittest.TestCase):
    """Test suite for duration formatting and time saved calculations."""

    def test_zero_seconds(self):
        res = format_duration(0)
        self.assertEqual(res["days"], 0)
        self.assertEqual(res["hours"], 0)
        self.assertEqual(res["minutes"], 0)
        self.assertEqual(res["seconds"], 0)
        self.assertEqual(res["text"], "0s")
        self.assertEqual(res["verbose"], "0 seconds")
        self.assertEqual(res["totalSeconds"], 0)

    def test_negative_seconds_clamped_to_zero(self):
        res = format_duration(-100)
        self.assertEqual(res["totalSeconds"], 0)
        self.assertEqual(res["text"], "0s")

    def test_seconds_only(self):
        res = format_duration(45)
        self.assertEqual(res["days"], 0)
        self.assertEqual(res["hours"], 0)
        self.assertEqual(res["minutes"], 0)
        self.assertEqual(res["seconds"], 45)
        self.assertEqual(res["text"], "45s")
        self.assertEqual(res["verbose"], "45 seconds")

    def test_minutes_and_seconds(self):
        # 2 mins, 5 secs = 125s
        res = format_duration(125)
        self.assertEqual(res["minutes"], 2)
        self.assertEqual(res["seconds"], 5)
        self.assertEqual(res["text"], "2m 5s")
        self.assertEqual(res["verbose"], "2 minutes, 5 seconds")

    def test_hours_minutes_seconds(self):
        # 1h 30m 15s = 3600 + 1800 + 15 = 5415s
        res = format_duration(5415)
        self.assertEqual(res["days"], 0)
        self.assertEqual(res["hours"], 1)
        self.assertEqual(res["minutes"], 30)
        self.assertEqual(res["seconds"], 15)
        self.assertEqual(res["text"], "1h 30m 15s")
        self.assertEqual(res["verbose"], "1 hour, 30 minutes, 15 seconds")

    def test_multi_day_duration(self):
        # 2 days, 3 hours, 4 minutes, 5 seconds
        # (2 * 86400) + (3 * 3600) + (4 * 60) + 5 = 172800 + 10800 + 240 + 5 = 183845s
        res = format_duration(183845)
        self.assertEqual(res["days"], 2)
        self.assertEqual(res["hours"], 3)
        self.assertEqual(res["minutes"], 4)
        self.assertEqual(res["seconds"], 5)
        self.assertEqual(res["text"], "2d 3h 4m 5s")
        self.assertEqual(res["verbose"], "2 days, 3 hours, 4 minutes, 5 seconds")


class TestTimeSavedFormatter(unittest.TestCase):
    """Test suite for format_time_saved function."""

    def test_no_time_saved_at_1x(self):
        self.assertEqual(format_time_saved(3600, 3600), "0m")

    def test_minutes_saved(self):
        # 1 hour at 1.5x speed -> 40 mins (2400s). Saved = 20 mins (1200s)
        self.assertEqual(format_time_saved(3600, 2400), "20m saved")

    def test_hours_and_minutes_saved(self):
        # 4 hours (14400s) at 2.0x speed -> 2 hours (7200s). Saved = 2h 0m
        self.assertEqual(format_time_saved(14400, 7200), "2h 0m saved")

        # 3 hours (10800s) at 1.5x speed -> 2 hours (7200s). Saved = 1h 0m
        self.assertEqual(format_time_saved(10800, 7200), "1h 0m saved")

    def test_slower_speed_clamped(self):
        # If speed duration > original duration, saved should be 0m
        self.assertEqual(format_time_saved(3600, 7200), "0m")


if __name__ == '__main__':
    unittest.main()
