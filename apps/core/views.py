"""Endpoints de configuración pública (lo que Angular necesita en runtime)."""

from constance import config
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class ConfigView(APIView):
    """Devuelve config editable desde admin (constance) que el frontend consume."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'site_name': config.SITE_NAME,
            'post_max_chars': config.POST_MAX_CHARS,
            'posts_per_page': config.POSTS_PER_PAGE,
        })


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok'})
