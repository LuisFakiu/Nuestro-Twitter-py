"""URLs raíz de Nandetuiter."""

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import LoginView
from apps.core.views import ApiRootView

urlpatterns = [
    path('', ApiRootView.as_view(), name='api-root'),
    path('admin/', admin.site.urls),

    # Core (config pública + health)
    path('api/', include('apps.core.urls')),

    # Auth JWT
    path('api/auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Apps
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.posts.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/messages/', include('apps.messaging.urls')),
]
