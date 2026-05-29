from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Verb(models.TextChoices):
        LIKE = 'like', 'Like'
        FOLLOW = 'follow', 'Follow'
        MENTION = 'mention', 'Mencion'
        REPLY = 'reply', 'Respuesta'
        REPOST = 'repost', 'Reposteado'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='notifications',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='acted_notifications',
    )
    verb = models.CharField(max_length=50, choices=Verb.choices)
    target_post = models.ForeignKey(
        'posts.Post', on_delete=models.CASCADE, null=True, blank=True,
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['recipient', 'is_read']),
        ]

    def __str__(self):
        return f'@{self.actor.username} {self.verb} -> @{self.recipient.username}'
