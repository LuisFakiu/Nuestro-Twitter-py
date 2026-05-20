"""URLs de posts."""
from django.urls import path

from .views import (
    FeedView,
    HashtagPostsView,
    PostListCreateView,
    SearchView,
    TrendingHashtagsView,
    UserPostsView,
    like_post,
)

app_name = 'posts'

urlpatterns = [
    path('feed/', FeedView.as_view(), name='feed'),
    path('posts/', PostListCreateView.as_view(), name='list-create'),
    path('posts/<int:pk>/like/', like_post, name='like-post'),
    path('users/<str:username>/posts/', UserPostsView.as_view(), name='user-posts'),
    path('hashtags/trending/', TrendingHashtagsView.as_view(), name='trending'),
    path('hashtags/<str:tag>/', HashtagPostsView.as_view(), name='hashtag-posts'),
    path('search/', SearchView.as_view(), name='search'),
]
