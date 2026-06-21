import re
import threading

from django.conf import settings
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.accounts.models import User

from .models import Hashtag, HashtagPost, Mention, Post


@receiver(post_save, sender=HashtagPost)
def increment_hashtag_count(sender, instance, created, **kwargs):
    if created:
        hashtag = instance.hashtag
        hashtag.post_count = hashtag.post_count + 1
        hashtag.save(update_fields=['post_count'])


@receiver(post_delete, sender=HashtagPost)
def decrement_hashtag_count(sender, instance, **kwargs):
    hashtag = instance.hashtag
    if hashtag.post_count > 0:
        hashtag.post_count = hashtag.post_count - 1
        hashtag.save(update_fields=['post_count'])


@receiver(post_save, sender=Post)
def parse_hashtags_and_mentions(sender, instance, created, **kwargs):
    HashtagPost.objects.filter(post=instance).delete()
    Mention.objects.filter(post=instance).delete()

    hashtag_names = set(re.findall(r'#(\w+)', instance.content))
    for name in hashtag_names:
        hashtag, _ = Hashtag.objects.get_or_create(name=name.lower())
        HashtagPost.objects.get_or_create(hashtag=hashtag, post=instance)

    usernames = set(re.findall(r'@(\w+)', instance.content))
    for username in usernames:
        try:
            user = User.objects.get(username__iexact=username)
            Mention.objects.get_or_create(post=instance, user=user)
        except User.DoesNotExist:
            pass


@receiver(post_save, sender=Mention)
def trigger_ai_bot_reply(sender, instance, created, **kwargs):
    """Si arrobaron al bot de IA, generar su respuesta en un thread aparte."""
    if not created:
        return
    if instance.user.username.lower() != settings.AI_BOT_USERNAME.lower():
        return
    # El bot no se responde a sí mismo.
    if instance.post.author_id == instance.user_id:
        return

    from .ai import reply_to_mention

    threading.Thread(
        target=reply_to_mention,
        args=(instance.post_id,),
        daemon=True,
    ).start()
