from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import BlockedUser, Follow, User

admin.site.register(User, UserAdmin)
admin.site.register(Follow)
admin.site.register(BlockedUser)
