from django.contrib import admin
from .models import Project, Member, ProjectMember, Link


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'date_from', 'date_to', 'created_at')
    list_display_links = ('name',)
    search_fields = ('name',)
    list_filter = ('date_from', 'date_to')
    filter_horizontal = ('members',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)


@admin.action(description="Mark selected as EDITOR")
def make_editor(modeladmin, request, queryset):
    queryset.update(is_editor=True)

@admin.action(description="Unmark selected as EDITOR")
def unmake_editor(modeladmin, request, queryset):
    queryset.update(is_editor=False)


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_editor', 'created_at')
    list_display_links = ('name',)
    search_fields = ('name',)
    list_filter = ('is_editor', 'created_at')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    actions = (make_editor, unmake_editor)

    fieldsets = (
        (None, {'fields': ('name', 'is_editor')}),
        ('Metadata', {'fields': ('created_at',)}),
    )


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ('project', 'member', 'added_at')
    list_display_links = ('project', 'member')
    list_filter = ('project', 'member')
    search_fields = ('project__name', 'member__name')
    ordering = ('-added_at',)
    readonly_fields = ('added_at',)


@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'owner', 'clicks', 'created_at')
    list_display_links = ('name',)
    list_filter = ('project', 'owner')
    search_fields = ('name', 'project__name', 'owner__name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
