# core/admin.py
from django.contrib import admin
from .models import Project, Member, ProjectMember, Link, ClickEvent


# ---------- Project ----------
class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 1
    autocomplete_fields = ("member",)
    verbose_name = "Участник проекта"
    verbose_name_plural = "Участники проекта"
    readonly_fields = ("added_at",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "date_from", "date_to", "created_at")
    list_display_links = ("name",)
    search_fields = ("name",)
    list_filter = ("date_from", "date_to")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)
    inlines = [ProjectMemberInline]   # вместо filter_horizontal
    # ВАЖНО: не использовать filter_horizontal('members') из-за through-модели


# ---------- Member ----------
@admin.action(description="Mark selected as EDITOR")
def make_editor(modeladmin, request, queryset):
    queryset.update(is_editor=True)

@admin.action(description="Unmark selected as EDITOR")
def unmake_editor(modeladmin, request, queryset):
    queryset.update(is_editor=False)

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("name", "is_editor", "created_at")
    list_display_links = ("name",)
    search_fields = ("name",)
    list_filter = ("is_editor", "created_at")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)
    actions = (make_editor, unmake_editor)
    fieldsets = (
        (None, {"fields": ("name", "is_editor")}),
        ("Metadata", {"fields": ("created_at",)}),
    )


# ---------- ProjectMember ----------
@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ("project", "member", "added_at")
    list_display_links = ("project", "member")
    list_filter = ("project", "member")
    search_fields = ("project__name", "member__name")
    ordering = ("-added_at",)
    readonly_fields = ("added_at",)


# ---------- Link ----------
@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "owner", "clicks", "unique_clicks_show", "created_at")
    list_display_links = ("name",)
    list_filter = ("project", "owner")
    search_fields = ("name", "project__name", "owner__name")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)
    autocomplete_fields = ("project", "owner")

    def unique_clicks_show(self, obj):
        # свойство из модели Link
        return obj.unique_clicks
    unique_clicks_show.short_description = "Уникальные клики"


# ---------- ClickEvent ----------
@admin.register(ClickEvent)
class ClickEventAdmin(admin.ModelAdmin):
    list_display = ("link", "user_key", "ip", "created_at")
    list_filter = ("link", "created_at")
    search_fields = ("user_key", "ip", "ua", "link__name")
    autocomplete_fields = ("link",)
    date_hierarchy = "created_at"
