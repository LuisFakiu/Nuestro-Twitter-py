"""
Endpoints de accounts.
"""
import re

from django.conf import settings
from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import BlockedUser, Follow, FollowRequest, User
from .utils import can_view_profile, is_blocked_by
from .serializers import (
    BlockedUserSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    MeSerializer,
    PublicProfileSerializer,
    RegisterSerializer,
)


def _unique_username(base):
    """Genera un username unico a partir de un texto base (ej. parte local del email)."""
    base = re.sub(r'[^a-zA-Z0-9_]', '', base) or 'user'
    base = base[:140]
    username = base
    i = 1
    while User.objects.filter(username__iexact=username).exists():
        username = f'{base}{i}'
        i += 1
    return username


def _auth_response(user):
    """Devuelve el mismo shape que login/register: {user, tokens}."""
    refresh = RefreshToken.for_user(user)
    refresh['username'] = user.username
    return Response({
        'user': MeSerializer(user).data,
        'tokens': {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        },
    })


GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def google_login(request):
    """Login con Google (flujo authorization code).

    El front manda el `code` que devuelve GIS. El backend lo canjea contra Google
    usando client_id + client_secret, obtiene el id_token, lo verifica y emite JWT.
    """
    code = request.data.get('code')
    if not code:
        return Response({'detail': 'Falta el code de Google.'},
                        status=status.HTTP_400_BAD_REQUEST)

    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        return Response({'detail': 'Login con Google no esta configurado en el servidor.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)

    import requests as http_requests
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    # 1. Canjear el code por tokens (aca se usa el client_secret).
    try:
        token_resp = http_requests.post(GOOGLE_TOKEN_ENDPOINT, data={
            'code': code,
            'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
            'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
            'redirect_uri': 'postmessage',  # valor especial para popup de GIS
            'grant_type': 'authorization_code',
        }, timeout=10)
    except http_requests.RequestException:
        return Response({'detail': 'No se pudo contactar a Google.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    if token_resp.status_code != 200:
        return Response({'detail': 'Code de Google invalido o expirado.'},
                        status=status.HTTP_401_UNAUTHORIZED)

    id_token_str = token_resp.json().get('id_token')
    if not id_token_str:
        return Response({'detail': 'Google no devolvio id_token.'},
                        status=status.HTTP_401_UNAUTHORIZED)

    # 2. Verificar el id_token y extraer datos del usuario.
    try:
        info = id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID,
        )
    except ValueError:
        return Response({'detail': 'id_token de Google invalido.'},
                        status=status.HTTP_401_UNAUTHORIZED)

    email = info.get('email')
    if not email or not info.get('email_verified'):
        return Response({'detail': 'El email de Google no esta verificado.'},
                        status=status.HTTP_401_UNAUTHORIZED)

    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        user = User.objects.create_user(
            username=_unique_username(email.split('@')[0]),
            email=email,
        )
        user.set_unusable_password()
        user.first_name = info.get('given_name', '')[:150]
        user.last_name = info.get('family_name', '')[:150]
        user.avatar_url = info.get('picture', '')
        user.save()

    return _auth_response(user)


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

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_authenticated:
            if is_blocked_by(blocker=instance, blocked=request.user):
                return Response(
                    {'detail': 'No encontrado.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if is_blocked_by(blocker=request.user, blocked=instance):
                return Response({
                    'username': instance.username,
                    'is_blocked': True,
                    'is_blocked_by': False,
                })
        return super().retrieve(request, *args, **kwargs)


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
        if is_blocked_by(blocker=target, blocked=request.user):
            return Response(
                {'error': 'No puedes seguir a este usuario'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if is_blocked_by(blocker=request.user, blocked=target):
            return Response(
                {'error': 'Tienes bloqueado a este usuario'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        existing_request = FollowRequest.objects.filter(
            follower=request.user, following=target
        ).first()
        if existing_request:
            return Response(
                {'error': 'Ya enviaste una solicitud a este usuario'},
                status=status.HTTP_409_CONFLICT,
            )
        if target.is_private:
            FollowRequest.objects.create(
                follower=request.user, following=target
            )
            return Response(status=status.HTTP_201_CREATED)
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
        deleted_req, _ = FollowRequest.objects.filter(
            follower=request.user, following=target
        ).delete()
        if deleted_req:
            return Response(status=status.HTTP_204_NO_CONTENT)
        deleted, _ = Follow.objects.filter(
            follower=request.user, following=target
        ).delete()
        if not deleted:
            return Response(
                {'error': 'No sigues a este usuario'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def pending_follow_requests(request):
    requests_qs = FollowRequest.objects.filter(
        following=request.user
    ).select_related('follower')
    data = [{
        'id': req.id,
        'username': req.follower.username,
        'avatar_url': req.follower.avatar_url,
        'bio': req.follower.bio,
        'created_at': req.created_at,
    } for req in requests_qs]
    return Response(data)


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def handle_follow_request(request, username):
    follower = get_object_or_404(User, username=username)
    follow_request = get_object_or_404(
        FollowRequest, follower=follower, following=request.user
    )

    if request.method == 'POST':
        Follow.objects.create(follower=follower, following=request.user)
        follow_request.delete()
        return Response(status=status.HTTP_201_CREATED)

    elif request.method == 'DELETE':
        follow_request.delete()
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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def block_user(request, username):
    target = get_object_or_404(User, username=username)
    if target == request.user:
        return Response(
            {'error': 'No puedes bloquearte a ti mismo'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    _, created = BlockedUser.objects.get_or_create(
        blocker=request.user, blocked=target
    )
    if not created:
        return Response(
            {'error': 'Ya tienes bloqueado a este usuario'},
            status=status.HTTP_409_CONFLICT,
        )
    Follow.objects.filter(
        Q(follower=request.user, following=target)
        | Q(follower=target, following=request.user)
    ).delete()
    FollowRequest.objects.filter(
        Q(follower=request.user, following=target)
        | Q(follower=target, following=request.user)
    ).delete()
    return Response(status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def unblock_user(request, username):
    target = get_object_or_404(User, username=username)
    deleted, _ = BlockedUser.objects.filter(
        blocker=request.user, blocked=target
    ).delete()
    if not deleted:
        return Response(
            {'error': 'No tienes bloqueado a este usuario'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)


class BlockedUsersListView(generics.ListAPIView):
    serializer_class = BlockedUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return BlockedUser.objects.filter(blocker=self.request.user)


class UserSearchView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        q = self.request.query_params.get('q', '')
        if not q:
            return User.objects.none()
        qs = User.objects.filter(
            Q(username__icontains=q) | Q(bio__icontains=q)
        )
        if self.request.user.is_authenticated:
            blocked_users = BlockedUser.objects.filter(
                blocker=self.request.user
            ).values('blocked')
            blocked_by = BlockedUser.objects.filter(
                blocked=self.request.user
            ).values('blocker')
            qs = qs.exclude(
                Q(pk__in=blocked_users) | Q(pk__in=blocked_by)
            )
        return qs[:10]


class FollowersListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = get_object_or_404(User, username=self.kwargs['username'])
        qs = User.objects.filter(following_set__following=user)
        if self.request.user.is_authenticated:
            blocked_users = BlockedUser.objects.filter(
                blocker=self.request.user
            ).values('blocked')
            blocked_by = BlockedUser.objects.filter(
                blocked=self.request.user
            ).values('blocker')
            qs = qs.exclude(
                Q(pk__in=blocked_users) | Q(pk__in=blocked_by)
            )
        return qs


class FollowingListView(generics.ListAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = get_object_or_404(User, username=self.kwargs['username'])
        qs = User.objects.filter(followers_set__follower=user)
        if self.request.user.is_authenticated:
            blocked_users = BlockedUser.objects.filter(
                blocker=self.request.user
            ).values('blocked')
            blocked_by = BlockedUser.objects.filter(
                blocked=self.request.user
            ).values('blocker')
            qs = qs.exclude(
                Q(pk__in=blocked_users) | Q(pk__in=blocked_by)
            )
        return qs
