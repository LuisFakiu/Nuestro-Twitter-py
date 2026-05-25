"""Endpoints de posts."""

from constance import config
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Hashtag, Like, Post
from .serializers import HashtagSerializer, PostSerializer, PostMinSerializer


class PostsPagination(PageNumberPagination):
    page_size_query_param = 'page_size'

    def get_page_size(self, request):
        return config.POSTS_PER_PAGE


class PostListCreateView(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    pagination_class = PostsPagination
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Post.objects.filter(
            parent__isnull=True, shared_post__isnull=True
        ).select_related('author')

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class PostDetailView(generics.RetrieveAPIView):
    queryset = Post.objects.select_related('author').all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class FeedView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = PostsPagination
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        following_users = self.request.user.following_set.values('following')
        return Post.objects.filter(
            Q(author__in=following_users, parent__isnull=True) |
            Q(author__in=following_users, shared_post__isnull=False)
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


class PostRepliesView(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    pagination_class = PostsPagination
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Post.objects.filter(
            parent_id=self.kwargs['pk']
        ).select_related('author')

    def perform_create(self, serializer):
        parent = generics.get_object_or_404(Post, pk=self.kwargs['pk'])
        serializer.save(author=self.request.user, parent=parent)


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def repost_post(request, pk):
    original = generics.get_object_or_404(Post, pk=pk)

    if request.method == 'POST':
        content = request.data.get('content', '').strip()
        existing = Post.objects.filter(
            author=request.user, shared_post=original
        ).first()
        if existing:
            return Response(
                {'error': 'Ya reposteaste este post'},
                status=status.HTTP_409_CONFLICT,
            )
        post = Post.objects.create(
            author=request.user,
            content=content,
            shared_post=original,
        )
        serializer = PostSerializer(post, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    elif request.method == 'DELETE':
        deleted, _ = Post.objects.filter(
            author=request.user, shared_post=original
        ).delete()
        if not deleted:
            return Response(
                {'error': 'No reposteaste este post'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


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


class HashtagSearchView(generics.ListAPIView):
    serializer_class = HashtagSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        q = self.request.query_params.get('q', '')
        if not q:
            return Hashtag.objects.none()
        return Hashtag.objects.filter(name__icontains=q).order_by('-post_count')[:10]


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_post(request, pk):
    post = generics.get_object_or_404(Post, pk=pk)
    if post.author != request.user:
        return Response(
            {'error': 'No puedes eliminar este post'},
            status=status.HTTP_403_FORBIDDEN,
        )
    post.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


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
