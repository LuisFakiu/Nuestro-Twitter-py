from rest_framework import serializers

from .models import Post


from .models import Hashtag, Post


class PostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_avatar = serializers.URLField(source='author.avatar_url', read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked = serializers.SerializerMethodField()
    hashtags_list = serializers.SerializerMethodField()
    mentions_list = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'author',
            'author_username',
            'author_avatar',
            'content',
            'image_url',
            'created_at',
            'updated_at',
            'likes_count',
            'is_liked',
            'hashtags_list',
            'mentions_list',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_hashtags_list(self, obj):
        return [h.name for h in obj.hashtags.all()]

    def get_mentions_list(self, obj):
        return [m.user.username for m in obj.mentions.all()]


class HashtagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hashtag
        fields = ['id', 'name', 'post_count']
