"""Endpoints de posts."""

from constance import config
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Hashtag, Like, Post
from .serializers import HashtagSerializer, PostSerializer


class PostsPagination(PageNumberPagination):
    page_size_query_param = 'page_size'

    def get_page_size(self, request):
        return config.POSTS_PER_PAGE


class PostListCreateView(generics.ListCreateAPIView):
    queryset = Post.objects.select_related('author').all()
    serializer_class = PostSerializer
    pagination_class = PostsPagination
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class FeedView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = PostsPagination
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        following_users = self.request.user.following_set.values('following')
        return Post.objects.filter(
            author__in=following_users
        ).select_related('author').order_by('-created_at')


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def like_post(request, pk):
    post = generics.get_object_or_404(Post, pk=pk)

    if request.method == 'POST':
        _, created = Like.objects.get_or_create(user=request.user, post=post)
        if not created:
            return Response(
                {'error': 'Ya te gusta este post'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_201_CREATED)

    elif request.method == 'DELETE':
        deleted, _ = Like.objects.filter(user=request.user, post=post).delete()
        if not deleted:
            return Response(
                {'error': 'No te gusta este post'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = PostsPagination

    def get_queryset(self):
        return Post.objects.filter(
            author__username=self.kwargs['username']
        ).select_related('author')


class HashtagPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = PostsPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Post.objects.filter(
            hashtags__name=self.kwargs['tag']
        ).select_related('author')


class TrendingHashtagsView(generics.ListAPIView):
    queryset = Hashtag.objects.order_by('-post_count')[:10]
    serializer_class = HashtagSerializer
    permission_classes = [permissions.AllowAny]


class SearchView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = PostsPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        q = self.request.query_params.get('q', '')
        if not q:
            return Post.objects.none()
        return Post.objects.filter(
            Q(content__icontains=q)
        ).select_related('author')
