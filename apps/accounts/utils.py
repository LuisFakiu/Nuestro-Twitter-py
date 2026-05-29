from django.db.models import Q

from .models import BlockedUser, User


def get_visible_users(user):
    """Returns users whose posts are visible to the given user (considering privacy)."""
    if user.is_authenticated:
        following = user.following_set.values('following')
        return User.objects.filter(
            Q(is_private=False)
            | Q(pk__in=following)
            | Q(pk=user.pk)
        )
    return User.objects.filter(is_private=False)


def can_view_profile(request, target_user):
    """Check if request user can view full profile of target_user."""
    if request.user == target_user:
        return True
    if not target_user.is_private:
        return True
    return target_user.followers_set.filter(follower=request.user).exists()


def is_blocked_by(blocker, blocked):
    return BlockedUser.objects.filter(blocker=blocker, blocked=blocked).exists()
