"""Settings de desarrollo. Hereda de base."""
from .base import *  # noqa: F401,F403

DEBUG = True

# Permitir todo en dev (Angular en 4200, Django en 8000)
CORS_ALLOW_ALL_ORIGINS = True
