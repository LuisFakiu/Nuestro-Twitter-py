import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nandetuiter.settings.prod')

django_asgi_app = get_asgi_application()

import apps.messaging.routing  # noqa: E402
from apps.messaging.jwt_auth import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTAuthMiddleware(
        URLRouter(
            apps.messaging.routing.websocket_urlpatterns
        )
    ),
})
