from django.contrib import admin
from .models import Project, Member, Link

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'date_from', 'date_to', 'created_at')
    search_fields = ('name',)

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_at')
    search_fields = ('name',)

@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'project', 'owner', 'clicks', 'created_at')
    list_filter = ('project', 'owner')
    search_fields = ('name', 'target_url')
