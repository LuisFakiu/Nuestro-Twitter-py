from django.urls import path

from . import views

app_name = 'messaging'

urlpatterns = [
    path('conversations/', views.conversation_list, name='conversation-list'),
    path(
        'conversations/get-or-create/',
        views.get_or_create,
        name='conversation-get-or-create',
    ),
    path(
        'conversations/<int:pk>/',
        views.conversation_detail,
        name='conversation-detail',
    ),
    path(
        'conversations/<int:pk>/read/',
        views.mark_read,
        name='conversation-mark-read',
    ),
]
