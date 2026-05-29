"""Comando para recalcular post_count de todos los hashtags."""

from django.core.management.base import BaseCommand

from apps.posts.models import Hashtag, HashtagPost


class Command(BaseCommand):
    help = 'Recalcula post_count para todos los hashtags basado en HashtagPost existentes'

    def handle(self, *args, **options):
        self.stdout.write('Recalculando post_count de hashtags...')

        hashtags = Hashtag.objects.all()
        updated = 0

        for hashtag in hashtags:
            count = HashtagPost.objects.filter(hashtag=hashtag).count()
            if hashtag.post_count != count:
                hashtag.post_count = count
                hashtag.save(update_fields=['post_count'])
                updated += 1
                self.stdout.write(f'  #{hashtag.name}: {hashtag.post_count} → {count}')

        self.stdout.write(self.style.SUCCESS(f'Listo. Se actualizaron {updated} hashtags.'))
