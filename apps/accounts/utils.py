from django.db.models import Q

from .models import BlockedUser, User


def get_visible_users(user):
    """Returns users whose posts are visible to the given user (considering privacy + blocks)."""
    if user.is_authenticated:
        following = user.following_set.values('following')
        blocked_users = BlockedUser.objects.filter(blocker=user).values('blocked')
        blocked_by = BlockedUser.objects.filter(blocked=user).values('blocker')
        return User.objects.filter(
            Q(is_private=False)
            | Q(pk__in=following)
            | Q(pk=user.pk)
        ).exclude(
            Q(pk__in=blocked_users) | Q(pk__in=blocked_by)
        )
    return User.objects.filter(is_private=False)


def can_view_profile(request, target_user):
    """Check if request user can view full profile of target_user (privacy + blocks)."""
    if request.user == target_user:
        return True
    if is_blocked_by(blocker=target_user, blocked=request.user):
        return False
    if is_blocked_by(blocker=request.user, blocked=target_user):
        return False
    if not target_user.is_private:
        return True
    return target_user.followers_set.filter(follower=request.user).exists()


def is_blocked_by(blocker, blocked):
    return BlockedUser.objects.filter(blocker=blocker, blocked=blocked).exists()
