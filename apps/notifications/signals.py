from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import Follow, FollowRequest
from apps.posts.models import Like, Mention, Post

from .models import Notification


@receiver(post_save, sender=Like)
def handle_like_notification(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.post.author == instance.user:
        return
    Notification.objects.create(
        recipient=instance.post.author,
        actor=instance.user,
        verb=Notification.Verb.LIKE,
        target_post=instance.post,
    )


@receiver(post_save, sender=FollowRequest)
def handle_follow_request_notification(sender, instance, created, **kwargs):
    if not created:
        return
    Notification.objects.create(
        recipient=instance.following,
        actor=instance.follower,
        verb=Notification.Verb.FOLLOW_REQUEST,
    )


@receiver(post_save, sender=Follow)
def handle_follow_notification(sender, instance, created, **kwargs):
    if not created:
        return
    Notification.objects.create(
        recipient=instance.following,
        actor=instance.follower,
        verb=Notification.Verb.FOLLOW,
    )


@receiver(post_save, sender=Mention)
def handle_mention_notification(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.user == instance.post.author:
        return
    Notification.objects.create(
        recipient=instance.user,
        actor=instance.post.author,
        verb=Notification.Verb.MENTION,
        target_post=instance.post,
    )


@receiver(post_save, sender=Post)
def handle_reply_repost_notification(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.parent_id and instance.parent.author != instance.author:
        Notification.objects.create(
            recipient=instance.parent.author,
            actor=instance.author,
            verb=Notification.Verb.REPLY,
            target_post=instance.parent,
        )
    if instance.shared_post_id and instance.shared_post.author != instance.author:
        Notification.objects.create(
            recipient=instance.shared_post.author,
            actor=instance.author,
            verb=Notification.Verb.REPOST,
            target_post=instance.shared_post,
        )
