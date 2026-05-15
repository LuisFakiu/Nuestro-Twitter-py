"""Settings de producción. Hereda de base."""
from .base import *  # noqa: F401,F403

DEBUG = False

# Seguridad mínima en prod
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
