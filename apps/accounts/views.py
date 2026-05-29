"""
Endpoints de accounts.
"""
from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import BlockedUser, Follow, User
from .serializers import (
    BlockedUserSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    MeSerializer,
    PublicProfileSerializer,
    RegisterSerializer,
)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class PublicProfileView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'username'


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def follow_user(request, username):
    target = get_object_or_404(User, username=username)

    if request.method == 'POST':
        if target == request.user:
            return Response(
                {'error': 'No puedes seguirte a ti mismo'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        _, created = Follow.objects.get_or_create(
            follower=request.user, following=target
        )
        if not created:
            return Response(
                {'error': 'Ya sigues a este usuario'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_201_CREATED)

    elif request.method == 'DELETE':
        deleted, _ = Follow.objects.filter(
            follower=request.user, following=target
        ).delete()
        if not deleted:
            return Response(
                {'error': 'No sigues a este usuario'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def remove_follower(request, username):
    follower = get_object_or_404(User, username=username)
    deleted, _ = Follow.objects.filter(
        follower=follower, following=request.user
    ).delete()
    if not deleted:
        return Response(
            {'error': 'Ese usuario no te sigue'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_privacy(request):
    user = request.user
    user.is_private = not user.is_private
    user.save(update_fields=['is_private'])
    return Response({'is_private': user.is_private})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(
        data=request.data, context={'request': request}
    )
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data['new_password'])
    request.user.save(update_fields=['password'])
    return Response({'detail': 'Contraseña actualizada correctamente.'})


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_account(request):
    request.user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


class UserSearchView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        q = self.request.query_params.get('q', '')
        if not q:
            return User.objects.none()
        return User.objects.filter(
            Q(username__icontains=q) | Q(bio__icontains=q)
        )[:10]


class FollowersListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = get_object_or_404(User, username=self.kwargs['username'])
        return User.objects.filter(following_set__following=user)


class FollowingListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = get_object_or_404(User, username=self.kwargs['username'])
        return User.objects.filter(followers_set__follower=user)
