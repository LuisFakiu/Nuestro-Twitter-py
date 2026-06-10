from django.contrib.auth import get_user_model
from django.db import models

from .models import Conversation, Message

User = get_user_model()


def get_or_create_conversation(user: User, other_user_id: int) -> Conversation:
    other = User.objects.get(id=other_user_id)
    qs = Conversation.objects.filter(participants=user).filter(participants=other)
    conversation = qs.annotate(cnt=models.Count('participants')).filter(cnt=2).first()
    if conversation:
        return conversation
    conversation = Conversation.objects.create()
    conversation.participants.set([user.id, other.id])
    return conversation


def send_message(user: User, conversation_id: int, content: str) -> Message:
    conversation = Conversation.objects.get(id=conversation_id)
    if not conversation.participants.filter(id=user.id).exists():
        raise PermissionError('No eres participante de esta conversación.')
    return Message.objects.create(
        conversation=conversation, sender=user, content=content
    )


def mark_conversation_read(user: User, conversation_id: int):
    conversation = Conversation.objects.get(id=conversation_id)
    conversation.messages.filter(is_read=False).exclude(sender=user).update(
        is_read=True
    )
