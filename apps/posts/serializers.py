from rest_framework import serializers

from .models import Hashtag, Post


class PostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_avatar = serializers.URLField(source='author.avatar_url', read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    reply_count = serializers.SerializerMethodField()
    repost_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()
    hashtags_list = serializers.SerializerMethodField()
    mentions_list = serializers.SerializerMethodField()
    parent_id = serializers.IntegerField(read_only=True)
    shared_post = serializers.SerializerMethodField()
    is_comment = serializers.SerializerMethodField()
    is_repost = serializers.SerializerMethodField()
    is_quote = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'author',
            'author_username',
            'author_avatar',
            'content',
            'image_url',
            'parent_id',
            'shared_post',
            'quoted_post_deleted',
            'created_at',
            'updated_at',
            'likes_count',
            'reply_count',
            'repost_count',
            'is_liked',
            'is_reposted',
            'is_comment',
            'is_repost',
            'is_quote',
            'hashtags_list',
            'mentions_list',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at', 'parent_id']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_is_reposted(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Post.objects.filter(
                author=request.user, shared_post=obj
            ).exists()
        return False

    def get_repost_count(self, obj):
        return Post.objects.filter(shared_post=obj).count()

    def get_reply_count(self, obj):
        count = 0
        current = [obj.id]
        while current:
            children = Post.objects.filter(parent_id__in=current).values_list('id', flat=True)
            child_ids = list(children)
            count += len(child_ids)
            current = child_ids
        return count

    def get_hashtags_list(self, obj):
        return [h.hashtag.name for h in obj.hashtags.all()]

    def get_mentions_list(self, obj):
        return [m.user.username for m in obj.mentions.all()]

    def get_is_comment(self, obj):
        return obj.parent_id is not None

    def get_is_repost(self, obj):
        return (obj.shared_post_id is not None or obj.quoted_post_deleted) and not obj.content

    def get_is_quote(self, obj):
        return (obj.shared_post_id is not None or obj.quoted_post_deleted) and bool(obj.content)

    def get_shared_post(self, obj):
        if not obj.shared_post_id:
            return None
        return PostMinSerializer(obj.shared_post, context=self.context).data


class PostMinSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_avatar = serializers.URLField(source='author.avatar_url', read_only=True)
    repost_count = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'author_username', 'author_avatar',
            'content', 'image_url', 'created_at', 'repost_count',
        ]

    def get_repost_count(self, obj):
        return Post.objects.filter(shared_post=obj).count()


class HashtagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hashtag
        fields = ['id', 'name', 'post_count']
