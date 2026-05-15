"""Tests de core: endpoint /api/config/ + maintenance middleware."""

from django.test import TestCase, override_settings
from django.urls import reverse


class ConfigEndpointTests(TestCase):
    def test_config_endpoint_returns_constance_values(self):
        response = self.client.get(reverse('core:config'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('site_name', data)
        self.assertIn('post_max_chars', data)
        self.assertIn('posts_per_page', data)
