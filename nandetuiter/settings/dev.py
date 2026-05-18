"""Settings de desarrollo. Hereda de base (SQLite)."""
from .base import *  # noqa: F401,F403

DEBUG = True

# CORS abierto para que el Angular dev server (4200) llegue al backend (8000)
CORS_ALLOW_ALL_ORIGINS = True
