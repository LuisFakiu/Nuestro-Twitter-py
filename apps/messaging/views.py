from django.db.models import Exists, OuterRef
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Conversation, ConversationSettings, Message
from .serializers import (
    ConversationCreateSerializer,
    ConversationListSerializer,
    MessageCreateSerializer,
    MessageSerializer,
)
from .services import get_or_create_conversation, mark_conversation_read, send_message


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversation_list(request):
    if request.method == 'GET':
        hidden_qs = ConversationSettings.objects.filter(
            conversation=OuterRef('pk'),
            user=request.user,
            is_hidden=True,
        )
        pinned_qs = ConversationSettings.objects.filter(
            conversation=OuterRef('pk'),
            user=request.user,
            is_pinned=True,
        )
        qs = (
            Conversation.objects.filter(participants=request.user)
            .annotate(
                user_is_pinned=Exists(pinned_qs),
                user_is_hidden=Exists(hidden_qs),
            )
            .filter(user_is_hidden=False)
            .order_by('-user_is_pinned', '-created_at')
        )
        serializer = ConversationListSerializer(
            qs, many=True, context={'request': request}
        )
        return Response(serializer.data)

    serializer = ConversationCreateSerializer(
        data=request.data, context={'request': request}
    )
    serializer.is_valid(raise_exception=True)
    conversation = serializer.save()
    out = ConversationListSerializer(
        conversation, context={'request': request}
    )
    return Response(out.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversation_detail(request, pk):
    try:
        conversation = Conversation.objects.get(
            id=pk, participants=request.user
        )
    except Conversation.DoesNotExist:
        return Response(
            {'detail': 'Conversación no encontrada.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == 'GET':
        messages = conversation.messages.all()
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    serializer = MessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    message = send_message(request.user, pk, serializer.validated_data['content'])
    out = MessageSerializer(message)
    return Response(out.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request, pk):
    try:
        Conversation.objects.get(id=pk, participants=request.user)
    except Conversation.DoesNotExist:
        return Response(
            {'detail': 'Conversación no encontrada.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    mark_conversation_read(request.user, pk)
    return Response({'detail': 'Marcado como leído.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_or_create(request):
    other_user_id = request.data.get('user_id')
    if not other_user_id:
        return Response(
            {'detail': 'user_id es requerido.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        conversation = get_or_create_conversation(request.user, other_user_id)
    except Exception as e:
        return Response(
            {'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST
        )
    pinned_qs = ConversationSettings.objects.filter(
        conversation=OuterRef('pk'),
        user=request.user,
        is_pinned=True,
    )
    hidden_qs = ConversationSettings.objects.filter(
        conversation=OuterRef('pk'),
        user=request.user,
        is_hidden=True,
    )
    conversation = Conversation.objects.filter(pk=conversation.pk).annotate(
        user_is_pinned=Exists(pinned_qs),
        user_is_hidden=Exists(hidden_qs),
    ).first()
    serializer = ConversationListSerializer(
        conversation, context={'request': request}
    )
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pin_conversation(request, pk):
    conv = Conversation.objects.get(id=pk, participants=request.user)
    ConversationSettings.objects.update_or_create(
        conversation=conv,
        user=request.user,
        defaults={'is_pinned': True},
    )
    return Response({'detail': 'Conversación fijada.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unpin_conversation(request, pk):
    conv = Conversation.objects.get(id=pk, participants=request.user)
    ConversationSettings.objects.update_or_create(
        conversation=conv,
        user=request.user,
        defaults={'is_pinned': False},
    )
    return Response({'detail': 'Conversación desfijada.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def hide_conversation(request, pk):
    conv = Conversation.objects.get(id=pk, participants=request.user)
    ConversationSettings.objects.update_or_create(
        conversation=conv,
        user=request.user,
        defaults={'is_hidden': True},
    )
    return Response({'detail': 'Conversación ocultada.'})
