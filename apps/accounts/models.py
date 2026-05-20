from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    bio = models.CharField(max_length=160, blank=True, default='')
    avatar_url = models.URLField(blank=True, default='')
    location = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username


class Follow(models.Model):
    follower = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='following_set'
    )
    following = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='followers_set'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['follower', 'following'], name='unique_follow'
            ),
            models.CheckConstraint(
                check=~models.Q(follower=models.F('following')),
                name='no_self_follow',
            ),
        ]

    def __str__(self):
        return f'{self.follower} -> {self.following}'
