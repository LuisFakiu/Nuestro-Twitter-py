"""Settings de producción. Hereda de base + cambia DB a Postgres."""
from decouple import config

from .base import *  # noqa: F401,F403

DEBUG = False

# En prod usamos Postgres. base.py default es SQLite (para dev sin friction).
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB'),
        'USER': config('POSTGRES_USER'),
        'PASSWORD': config('POSTGRES_PASSWORD'),
        'HOST': config('POSTGRES_HOST', default='localhost'),
        'PORT': config('POSTGRES_PORT', default='5432'),
    }
}

REDIS_URL = config('REDIS_URL', default=None)
if REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [REDIS_URL],
            },
        },
    }

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Render (y otros PaaS) terminan TLS en un proxy y reenvían por HTTP.
# Sin esto request.is_secure() es False y la verificación CSRF/referer en
# HTTPS falla con "CSRF verification failed".
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
