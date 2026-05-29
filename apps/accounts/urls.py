"""URLs de accounts."""
from django.urls import path

from . import views

app_name = 'accounts'

urlpatterns = [
    path('me/', views.MeView.as_view(), name='me'),
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('users/', views.UserSearchView.as_view(), name='user-search'),
    path('users/<str:username>/', views.PublicProfileView.as_view(), name='public-profile'),
    path('users/<str:username>/follow/', views.follow_user, name='follow-user'),
    path('users/<str:username>/remove-follower/', views.remove_follower, name='remove-follower'),
    path('users/<str:username>/followers/', views.FollowersListView.as_view(), name='followers'),
    path('users/<str:username>/following/', views.FollowingListView.as_view(), name='following'),
]
