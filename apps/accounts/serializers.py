from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import BlockedUser, FollowRequest, User


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'bio',
            'avatar_url',
            'location',
            'is_private',
            'date_joined',
        ]
        read_only_fields = ['id', 'username', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']
        read_only_fields = ['id']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True},
        }

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Ese usuario ya existe.')
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Ese email ya está registrado.')
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )

    def to_representation(self, instance):
        refresh = RefreshToken.for_user(instance)
        return {
            'user': MeSerializer(instance).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
        }


class PublicProfileSerializer(serializers.ModelSerializer):
    followers_count = serializers.IntegerField(source='followers_set.count', read_only=True)
    following_count = serializers.IntegerField(source='following_set.count', read_only=True)
    posts_count = serializers.IntegerField(source='posts.count', read_only=True)
    is_following = serializers.SerializerMethodField()
    is_pending_follow = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()
    is_blocked_by = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'username', 'bio', 'avatar_url', 'location',
            'is_private', 'date_joined', 'followers_count',
            'following_count', 'posts_count', 'is_following',
            'is_pending_follow', 'is_blocked', 'is_blocked_by',
        ]

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.followers_set.filter(follower=request.user).exists()
        return False

    def get_is_pending_follow(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return FollowRequest.objects.filter(
                follower=request.user, following=obj
            ).exists()
        return False

    def get_is_blocked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return BlockedUser.objects.filter(
                blocker=request.user, blocked=obj
            ).exists()
        return False

    def get_is_blocked_by(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return BlockedUser.objects.filter(
                blocker=obj, blocked=request.user
            ).exists()
        return False


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        return {
            'user': MeSerializer(self.user).data,
            'tokens': {
                'access': data['access'],
                'refresh': data['refresh'],
            },
        }


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual no es correcta.')
        return value


class BlockedUserSerializer(serializers.ModelSerializer):
    blocked_username = serializers.CharField(source='blocked.username', read_only=True)
    blocked_avatar = serializers.CharField(source='blocked.avatar_url', read_only=True)

    class Meta:
        model = BlockedUser
        fields = ['id', 'blocked', 'blocked_username', 'blocked_avatar', 'created_at']
        read_only_fields = ['id', 'blocked_username', 'blocked_avatar', 'created_at']
