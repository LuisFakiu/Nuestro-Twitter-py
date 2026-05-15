"""Middleware que bloquea la app cuando MAINTENANCE_MODE está activo."""

from django.http import JsonResponse


class MaintenanceModeMiddleware:
    EXEMPT_PREFIXES = ('/admin/', '/static/', '/api/config/')

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from constance import config

        if config.MAINTENANCE_MODE:
            user = getattr(request, 'user', None)
            is_staff = bool(user and user.is_authenticated and user.is_staff)
            path_exempt = any(request.path.startswith(p) for p in self.EXEMPT_PREFIXES)
            if not is_staff and not path_exempt:
                return JsonResponse(
                    {
                        'detail': 'Sitio en mantenimiento. Volvé en un rato.',
                        'maintenance': True,
                    },
                    status=503,
                )

        return self.get_response(request)
