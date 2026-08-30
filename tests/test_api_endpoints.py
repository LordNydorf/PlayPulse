import unittest
from unittest.mock import patch
import sys
import os
import json

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app, playlist_cache
import time


class TestApiEndpoints(unittest.TestCase):
    """Test suite for Flask HTTP endpoints and static file delivery."""

    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        playlist_cache.clear()

    def test_index_route(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'PlayPulse', response.data)
        self.assertIn(b'/app.js', response.data)
        self.assertIn(b'/styles.css', response.data)

    def test_static_assets_served(self):
        # CSS
        css_res = self.client.get('/styles.css')
        self.assertEqual(css_res.status_code, 200)
        self.assertIn('text/css', css_res.content_type)

        # JS
        js_res = self.client.get('/app.js')
        self.assertEqual(js_res.status_code, 200)
        self.assertIn('javascript', js_res.content_type)

        # Manifest
        manifest_res = self.client.get('/site.webmanifest')
        self.assertEqual(manifest_res.status_code, 200)

        # Favicon svg
        favicon_res = self.client.get('/favicon.svg')
        self.assertEqual(favicon_res.status_code, 200)

    def test_calculate_missing_url(self):
        response = self.client.post('/get_playlist_duration', json={})
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)
        self.assertIn('Please enter a YouTube playlist URL or ID', data['error'])

    def test_calculate_invalid_url(self):
        response = self.client.post('/get_playlist_duration', json={'url': 'https://google.com/search?q=test'})
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)
        self.assertIn('Invalid YouTube playlist URL or ID', data['error'])

    @patch('app.fetch_playlist_data')
    def test_calculate_success_mock(self, mock_fetch):
        # Mock successful fetch response
        mock_fetch.return_value = {
            'playlist': {
                'id': 'PLtest123',
                'title': 'Test Python Course',
                'channelTitle': 'Test Channel',
                'thumbnail': 'https://example.com/thumb.jpg',
                'videoCount': 2
            },
            'totalSeconds': 3600,
            'formatted': {
                'text': '1h 0m 0s',
                'verbose': '1 hour, 0 minutes, 0 seconds',
                'days': 0,
                'hours': 1,
                'minutes': 0,
                'seconds': 0,
                'totalSeconds': 3600
            },
            'speeds': {
                '1.0': {'speed': 1.0, 'seconds': 3600, 'formatted': {'text': '1h 0m 0s'}, 'timeSaved': '0m'},
                '1.5': {'speed': 1.5, 'seconds': 2400, 'formatted': {'text': '40m 0s'}, 'timeSaved': '20m saved'}
            },
            'stats': {
                'avgSeconds': 1800,
                'avgFormatted': '30m 0s',
                'shortest': {'title': 'Intro', 'duration': '10m 0s', 'seconds': 600},
                'longest': {'title': 'Deep Dive', 'duration': '50m 0s', 'seconds': 3000}
            },
            'videos': [
                {'id': 'v1', 'title': 'Intro', 'durationSeconds': 600, 'duration': '10m 0s', 'position': 1},
                {'id': 'v2', 'title': 'Deep Dive', 'durationSeconds': 3000, 'duration': '50m 0s', 'position': 2}
            ]
        }

        response = self.client.post('/get_playlist_duration', json={
            'url': 'https://www.youtube.com/playlist?list=PLtest123'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('X-Cache'), 'MISS')
        data = json.loads(response.data)
        self.assertEqual(data['playlist']['title'], 'Test Python Course')
        self.assertEqual(data['totalDuration'], '1 hour, 0 minutes, 0 seconds')
        self.assertEqual(len(data['videos']), 2)
        self.assertFalse(data.get('fromCache', False))

    @patch('app.fetch_playlist_data')
    def test_cache_hit_on_repeated_requests(self, mock_fetch):
        mock_fetch.return_value = {
            'playlist': {'id': 'PLcache_test', 'title': 'Cached Course', 'channelTitle': 'Test', 'videoCount': 1},
            'totalSeconds': 600,
            'formatted': {'text': '10m 0s', 'verbose': '10 minutes, 0 seconds'},
            'speeds': {},
            'stats': {},
            'videos': [{'id': 'v1', 'title': 'V1', 'durationSeconds': 600, 'duration': '10m 0s'}]
        }

        # First request (Cache MISS)
        res1 = self.client.post('/get_playlist_duration', json={'url': 'PLcache_test'})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.headers.get('X-Cache'), 'MISS')
        self.assertEqual(mock_fetch.call_count, 1)

        # Second request (Cache HIT)
        res2 = self.client.post('/get_playlist_duration', json={'url': 'PLcache_test'})
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.headers.get('X-Cache'), 'HIT')
        data2 = json.loads(res2.data)
        self.assertTrue(data2.get('fromCache', True))
        # Ensure YouTube API fetch was NOT called a second time
        self.assertEqual(mock_fetch.call_count, 1)

    @patch('app.fetch_playlist_data')
    def test_cache_expiration(self, mock_fetch):
        mock_fetch.return_value = {
            'playlist': {'id': 'PLexpire_test', 'title': 'Expiry Course', 'channelTitle': 'Test', 'videoCount': 1},
            'totalSeconds': 600,
            'formatted': {'text': '10m 0s', 'verbose': '10 minutes, 0 seconds'},
            'speeds': {},
            'stats': {},
            'videos': []
        }

        # Populate cache with old timestamp
        playlist_cache.set('PLexpire_test', {
            'playlist': {'id': 'PLexpire_test'},
            'formatted': {'verbose': 'old'}
        })
        # Artificially age the entry past TTL (3600s)
        playlist_cache.cache['PLexpire_test']['timestamp'] = time.time() - 4000

        # Request should treat entry as expired, fetch fresh data, and return MISS
        res = self.client.post('/get_playlist_duration', json={'url': 'PLexpire_test'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get('X-Cache'), 'MISS')
        self.assertEqual(mock_fetch.call_count, 1)

    @patch('app.fetch_playlist_data')
    def test_error_responses_not_cached(self, mock_fetch):
        mock_fetch.return_value = {'error': 'Playlist not found.'}

        res = self.client.post('/get_playlist_duration', json={'url': 'PLnotfound123'})
        self.assertEqual(res.status_code, 400)
        self.assertIsNone(playlist_cache.get('PLnotfound123'))


if __name__ == '__main__':
    unittest.main()
