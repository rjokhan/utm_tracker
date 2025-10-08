# core/views.py
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.db.models import Count
from .models import Project, Member, Link, ClickEvent


# ---------- Страницы ----------

def index_page(request):
    """Главная панель (Dashboard)."""
    return render(request, "index.html")


def projects_page(request):
    """Список всех проектов."""
    return render(request, "projects.html")


def project_page(request, pk):
    """Страница конкретного проекта."""
    project = get_object_or_404(Project, pk=pk)
    return render(request, "project.html", {"project": project})


def members_page(request):
    """Список участников."""
    return render(request, "members.html")


# ---------- API: Клики и статистика ----------

def track_click(request):
    """
    Регистрирует клик по ссылке.
    В URL ожидается ?link=<id>&user=<user_key>
    """
    link_id = request.GET.get("link")
    user_key = request.GET.get("user")

    if not link_id:
        return JsonResponse({"detail": "Missing link id"}, status=400)

    try:
        link = Link.objects.get(pk=link_id)
    except Link.DoesNotExist:
        return JsonResponse({"detail": "Link not found"}, status=404)

    # Создаём событие
    ClickEvent.objects.create(link=link, user_key=user_key or None)
    return JsonResponse({"ok": True})


def link_stats(request, link_id: int):
    """
    Возвращает статистику по одной ссылке:
    - всего кликов
    - уникальных пользователей
    """
    qs = ClickEvent.objects.filter(link_id=link_id)
    total_clicks = qs.count()
    unique_users = qs.values("user_key").distinct().count()
    return JsonResponse({
        "link_id": link_id,
        "total_clicks": total_clicks,
        "unique_users": unique_users,
    })


def project_stats(request):
    """
    Глобальная статистика по всем проектам (для Dashboard):
    - общее количество проектов
    - количество ссылок
    - суммарные клики
    - количество уникальных пользователей
    """
    total_projects = Project.objects.count()
    total_links = Link.objects.count()
    total_clicks = ClickEvent.objects.count()
    unique_users = ClickEvent.objects.values("user_key").distinct().count()

    data = {
        "total_projects": total_projects,
        "total_links": total_links,
        "total_clicks": total_clicks,
        "unique_users": unique_users,
    }
    return JsonResponse(data)


# ✅ Новый эндпоинт — статистика по одному конкретному проекту
def project_stats_one(request, project_id: int):
    """
    Возвращает статистику по конкретному проекту:
    - количество кликов
    - количество уникальных пользователей (по user_key)
    """
    qs = ClickEvent.objects.filter(link__project_id=project_id)
    data = {
        "project_id": project_id,
        "total_clicks": qs.count(),
        "unique_users": qs.values("user_key").distinct().count(),
    }
    return JsonResponse(data)
