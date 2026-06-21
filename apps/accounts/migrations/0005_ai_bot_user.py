"""Crea el usuario del bot de IA (estilo Grok, vía Gemini).

Necesario para que el parser de menciones reconozca @<AI_BOT_USERNAME> y dispare
la respuesta automática. Idempotente: usa get_or_create.
"""
from django.conf import settings
from django.db import migrations


def create_ai_bot(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    username = getattr(settings, 'AI_BOT_USERNAME', 'lekaja')
    User.objects.get_or_create(
        username=username,
        defaults={
            'bio': '🤖 Bot de IA paraguayo. Arrobame en un comentario y te respondo, che olou.',
            'is_active': True,
            'is_staff': False,
            'is_superuser': False,
            'password': '!',  # password inutilizable; el bot no hace login
        },
    )


def remove_ai_bot(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    username = getattr(settings, 'AI_BOT_USERNAME', 'lekaja')
    User.objects.filter(username=username).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_followrequest'),
    ]

    operations = [
        migrations.RunPython(create_ai_bot, remove_ai_bot),
    ]
