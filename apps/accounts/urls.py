"""URLs de accounts."""
from django.urls import path

from . import views

app_name = 'accounts'

urlpatterns = [
    path('me/', views.MeView.as_view(), name='me'),
    path('me/privacy/', views.toggle_privacy, name='toggle-privacy'),
    path('me/change-password/', views.change_password, name='change-password'),
    path('me/delete-account/', views.delete_account, name='delete-account'),
    path('me/blocked/', views.BlockedUsersListView.as_view(), name='blocked-users'),
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('users/', views.UserSearchView.as_view(), name='user-search'),
    path('users/<str:username>/', views.PublicProfileView.as_view(), name='public-profile'),
    path('users/<str:username>/follow/', views.follow_user, name='follow-user'),
    path('users/<str:username>/remove-follower/', views.remove_follower, name='remove-follower'),
    path('users/<str:username>/block/', views.block_user, name='block-user'),
    path('users/<str:username>/unblock/', views.unblock_user, name='unblock-user'),
    path('users/<str:username>/followers/', views.FollowersListView.as_view(), name='followers'),
    path('users/<str:username>/following/', views.FollowingListView.as_view(), name='following'),
]
