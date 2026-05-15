"""URLs raíz de Nandetuiter."""

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Core (config pública + health)
    path('api/', include('apps.core.urls')),

    # Auth JWT
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Apps
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.posts.urls')),
]
