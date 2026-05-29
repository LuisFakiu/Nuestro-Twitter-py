"""URLs de posts."""
from django.urls import path

from .views import (
    FeedView,
    HashtagPostsView,
    HashtagSearchView,
    PostDetailView,
    PostListCreateView,
    PostRepliesView,
    SearchView,
    TrendingHashtagsView,
    UserPostsView,
    delete_post,
    like_post,
    repost_post,
)

app_name = 'posts'

urlpatterns = [
    path('feed/', FeedView.as_view(), name='feed'),
    path('posts/', PostListCreateView.as_view(), name='list-create'),
    path('posts/<int:pk>/detail/', PostDetailView.as_view(), name='post-detail'),
    path('posts/<int:pk>/like/', like_post, name='like-post'),
    path('posts/<int:pk>/replies/', PostRepliesView.as_view(), name='post-replies'),
    path('posts/<int:pk>/repost/', repost_post, name='repost-post'),
    path('posts/<int:pk>/', delete_post, name='delete-post'),
    path('users/<str:username>/posts/', UserPostsView.as_view(), name='user-posts'),
    path('hashtags/trending/', TrendingHashtagsView.as_view(), name='trending'),
    path('hashtags/search/', HashtagSearchView.as_view(), name='hashtag-search'),
    path('hashtags/<str:tag>/', HashtagPostsView.as_view(), name='hashtag-posts'),
    path('search/', SearchView.as_view(), name='search'),
]
