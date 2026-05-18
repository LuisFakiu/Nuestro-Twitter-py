"""URLs de accounts."""
from django.urls import path

from . import views

app_name = 'accounts'

urlpatterns = [
    path('me/', views.MeView.as_view(), name='me'),
    path('auth/register/', views.RegisterView.as_view(), name='register'),
]
