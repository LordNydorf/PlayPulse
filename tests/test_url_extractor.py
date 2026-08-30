import unittest
import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import extract_playlist_id


class TestPlaylistUrlExtractor(unittest.TestCase):
    """Test suite for extracting YouTube playlist IDs from various URL formats."""

    def test_standard_playlist_url(self):
        url = "https://www.youtube.com/playlist?list=PL4cUxeGkcC9gC88BEo9czgyS21VJPErs"
        self.assertEqual(extract_playlist_id(url), "PL4cUxeGkcC9gC88BEo9czgyS21VJPErs")

    def test_video_in_playlist_url(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL4cUxeGkcC9gC88BEo9czgyS21VJPErs&index=1"
        self.assertEqual(extract_playlist_id(url), "PL4cUxeGkcC9gC88BEo9czgyS21VJPErs")

    def test_youtube_music_playlist_url(self):
        url = "https://music.youtube.com/playlist?list=PL4cUxeGkcC9gC88BEo9czgyS21VJPErs"
        self.assertEqual(extract_playlist_id(url), "PL4cUxeGkcC9gC88BEo9czgyS21VJPErs")

    def test_shortened_youtu_be_url(self):
        url = "https://youtu.be/dQw4w9WgXcQ?list=PL4cUxeGkcC9gC88BEo9czgyS21VJPErs"
        self.assertEqual(extract_playlist_id(url), "PL4cUxeGkcC9gC88BEo9czgyS21VJPErs")

    def test_url_with_share_and_tracking_params(self):
        url = "https://www.youtube.com/playlist?list=PL4cUxeGkcC9gC88BEo9czgyS21VJPErs&si=abcdef123&feature=share"
        self.assertEqual(extract_playlist_id(url), "PL4cUxeGkcC9gC88BEo9czgyS21VJPErs")

    def test_direct_playlist_id_pl(self):
        pid = "PL4cUxeGkcC9gC88BEo9czgyS21VJPErs"
        self.assertEqual(extract_playlist_id(pid), "PL4cUxeGkcC9gC88BEo9czgyS21VJPErs")

    def test_direct_playlist_id_special_prefixes(self):
        # Album / Topic playlists
        pid = "OLAK5uy_kXz9Q_sample12345"
        self.assertEqual(extract_playlist_id(pid), "OLAK5uy_kXz9Q_sample12345")
        
        # User upload playlist
        pid = "UUbW18JZ95GY4djMV451Upw"
        self.assertEqual(extract_playlist_id(pid), "UUbW18JZ95GY4djMV451Upw")

    def test_url_with_surrounding_whitespace(self):
        url = "   https://www.youtube.com/playlist?list=PL4cUxeGkcC9gC88BEo9czgyS21VJPErs   "
        self.assertEqual(extract_playlist_id(url), "PL4cUxeGkcC9gC88BEo9czgyS21VJPErs")

    def test_invalid_urls(self):
        # Standard video without a playlist list= parameter
        self.assertIsNone(extract_playlist_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        # Empty string and None
        self.assertIsNone(extract_playlist_id(""))
        self.assertIsNone(extract_playlist_id(None))
        # Non-YouTube URL
        self.assertIsNone(extract_playlist_id("https://github.com/LordNydorf/YTplaylistCalc"))
        # Short random text
        self.assertIsNone(extract_playlist_id("hello"))


if __name__ == '__main__':
    unittest.main()
