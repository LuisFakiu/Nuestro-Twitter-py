from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Conversation, Message

User = get_user_model()


class UserMinSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar_url']


class MessageSerializer(serializers.ModelSerializer):
    sender = UserMinSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'content', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender', 'is_read', 'created_at']


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['content']


class ConversationListSerializer(serializers.ModelSerializer):
    participants = UserMinSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_pinned = serializers.BooleanField(source='user_is_pinned', read_only=True, default=False)

    class Meta:
        model = Conversation
        fields = ['id', 'participants', 'last_message', 'unread_count', 'is_pinned', 'created_at']

    def get_last_message(self, obj):
        last = obj.messages.last()
        if last:
            return MessageSerializer(last).data
        return None

    def get_unread_count(self, obj):
        user = self.context['request'].user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()


class ConversationCreateSerializer(serializers.ModelSerializer):
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True
    )

    class Meta:
        model = Conversation
        fields = ['participant_ids']

    def validate_participant_ids(self, value):
        if not value:
            raise serializers.ValidationError('Debe haber al menos un participante.')
        users = User.objects.filter(id__in=value)
        if len(users) != len(value):
            raise serializers.ValidationError('Uno o más participantes no existen.')
        return value

    def create(self, validated_data):
        participant_ids = validated_data.pop('participant_ids')
        user = self.context['request'].user
        all_ids = list(set(participant_ids + [user.id]))
        conversation = Conversation.objects.create()
        conversation.participants.set(all_ids)
        return conversation
