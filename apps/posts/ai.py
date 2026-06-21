"""Bot de IA estilo Grok usando la API de Gemini (vía REST con requests).

Cuando un usuario arroba al bot (@lekaja) en un post o comentario, se genera
una respuesta con Gemini y se publica como reply al post que lo mencionó.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GEMINI_URL = (
    'https://generativelanguage.googleapis.com/v1beta/models/'
    '{model}:generateContent'
)

# Personalidad del bot: ingenioso y sarcástico (estilo Grok) pero hablando como
# paraguayo cheto asunceno, con jopara/slang ("che olou", "nde", "luego", "ko").
SYSTEM_PROMPT = (
    'Sos {name}, un bot de IA en una red social tipo Twitter. Sos paraguayo, '
    'cheto asunceno: hablás canchero con jopara y slang paraguayo (ej: "che '
    'olou", "nde", "luego", "ko", "pio", "na", "guapo/a"), sin exagerar tanto '
    'que no se entienda. Respondés con ingenio, humor y un toque sarcástico '
    'estilo Grok, pero siempre útil y sin ser ofensivo. Breve y al grano. '
    'Tu respuesta es un comentario público, así que máximo {max_chars} '
    'caracteres. No uses hashtags ni te presentes, andá directo a responder.'
)


def get_bot_user():
    """Devuelve (creando si hace falta) el usuario del bot de IA."""
    from apps.accounts.models import User

    username = settings.AI_BOT_USERNAME
    bot, created = User.objects.get_or_create(
        username=username,
        defaults={
            'bio': '🤖 Bot de IA paraguayo. Arrobame en un comentario y te respondo, che olou.',
            'is_active': True,
        },
    )
    if created:
        bot.set_unusable_password()
        bot.save(update_fields=['password'])
    return bot


def _max_chars():
    try:
        from constance import config as cconfig
        return int(cconfig.POST_MAX_CHARS)
    except Exception:
        return 280


def generate_reply(user_text, context_text=''):
    """Llama a Gemini y devuelve el texto de la respuesta, o None si falla."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.warning('GEMINI_API_KEY no configurada; el bot no puede responder.')
        return None

    max_chars = _max_chars()
    system = SYSTEM_PROMPT.format(name=settings.AI_BOT_USERNAME, max_chars=max_chars)

    prompt = user_text.strip()
    if context_text:
        prompt = (
            f'Contexto del post original: "{context_text.strip()}"\n\n'
            f'El usuario te dijo: "{user_text.strip()}"'
        )

    url = GEMINI_URL.format(model=settings.GEMINI_MODEL)
    payload = {
        'system_instruction': {'parts': [{'text': system}]},
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'maxOutputTokens': 300,
            'temperature': 0.9,
        },
    }

    try:
        resp = requests.post(
            url,
            headers={'X-goog-api-key': api_key},
            json=payload,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.error('Error llamando a Gemini: %s', exc)
        return None

    # Si la respuesta vino vacía, bloqueada por seguridad o sin texto usable,
    # NO respondemos (mejor silencio que postear un error).
    candidates = data.get('candidates') or []
    if not candidates:
        logger.warning('Gemini sin candidates (posible bloqueo): %s', data.get('promptFeedback'))
        return None
    try:
        text = candidates[0]['content']['parts'][0]['text'].strip()
    except (KeyError, IndexError, TypeError):
        logger.warning('Gemini sin texto usable en la respuesta.')
        return None
    if not text:
        return None

    if len(text) > max_chars:
        text = text[: max_chars - 1].rstrip() + '…'
    return text


def reply_to_mention(post_id):
    """Genera y publica la respuesta del bot al post que lo mencionó.

    Pensado para correr en un thread aparte; abre y cierra su propia conexión.
    """
    from django.db import connection

    from .models import Post

    try:
        post = Post.objects.select_related('author', 'parent').get(pk=post_id)
        bot = get_bot_user()

        # Evitar loops: el bot no se responde a sí mismo.
        if post.author_id == bot.id:
            return
        # Evitar responder dos veces al mismo post.
        if Post.objects.filter(parent=post, author=bot).exists():
            return

        context = post.parent.content if post.parent_id else ''
        text = generate_reply(post.content, context_text=context)
        if not text:
            return

        # Arrobamos a quien nos llamó para que le llegue la notificación.
        mention = f'@{post.author.username} '
        content = mention + text
        max_chars = _max_chars()
        if len(content) > max_chars:
            content = content[:max_chars]

        Post.objects.create(author=bot, content=content, parent=post)
    except Exception as exc:  # noqa: BLE001 - thread, no queremos que reviente
        logger.error('Fallo generando respuesta del bot: %s', exc)
    finally:
        connection.close()
