import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.accounts.models import User
from apps.messaging.models import Conversation, Message


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'

        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close()
            return

        is_participant = await self._is_participant(user, self.conversation_id)
        if not is_participant:
            await self.close()
            return

        self.user = user

        await self.channel_layer.group_add(
            self.room_group_name, self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name, self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        content = data.get('content', '').strip()
        if not content:
            return

        message = await self._save_message(self.user, self.conversation_id, content)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'id': message.id,
                'sender_id': message.sender_id,
                'sender_username': message.sender.username,
                'sender_avatar': message.sender.avatar_url,
                'content': message.content,
                'created_at': message.created_at.isoformat(),
            },
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'id': event['id'],
            'sender': {
                'id': event['sender_id'],
                'username': event['sender_username'],
                'avatar_url': event['sender_avatar'],
            },
            'content': event['content'],
            'created_at': event['created_at'],
        }))

    @database_sync_to_async
    def _is_participant(self, user, conversation_id):
        return Conversation.objects.filter(
            id=conversation_id, participants=user
        ).exists()

    @database_sync_to_async
    def _save_message(self, user, conversation_id, content):
        return Message.objects.create(
            conversation_id=conversation_id,
            sender=user,
            content=content,
        )
