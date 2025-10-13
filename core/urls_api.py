# core/urls_api.py
from django.urls import path
from utmtracker import views as api   # CRUD и агрегаты
from core import views as stats       # трекинг кликов и стат-эндпоинты

urlpatterns = [
    # ---------- Участники ----------
    path("members/", api.members_list, name="api_members_list"),
    path("members/create/", api.member_create, name="api_member_create"),

    # ---------- Проекты ----------
    path("projects/", api.projects_list, name="api_projects_list"),
    # если нужен список ссылок в проекте — используйте уже имеющийся роут:
    # /api/projects/<int:pk>/links/by-owner/<int:owner_id>
    # (он объявлен в utmtracker/urls.py)

    # ---------- Клики и статистика ----------
    path("track-click/", stats.track_click, name="api_track_click"),
    path("link-stats/<int:link_id>/", stats.link_stats, name="api_link_stats"),
    path("project-stats/", stats.project_stats, name="api_project_stats"),
    path("project-stats/<int:project_id>/", stats.project_stats_one, name="api_project_stats_one"),
]
