# core/views.py
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest
from django.db.models import F
from django.utils.timezone import now
from .models import Project, Member, Link, ClickEvent
import hashlib


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

def _client_ip(request):
    """Возвращает IP клиента с учётом прокси."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def track_click(request):
    """
    Регистрирует клик по ссылке.
    Поддерживает:
      - GET:  ?link=<id>&user=<user_key>
      - POST: link=<id>, user=<user_key>
    """
    link_id = request.GET.get("link") or request.POST.get("link")
    ua = request.META.get("HTTP_USER_AGENT", "")
    ip = _client_ip(request)
    user_key = (request.GET.get("user") or request.POST.get("user") or "").strip()
    if not user_key:
        user_key = hashlib.sha256(f"{ip}-{ua}".encode()).hexdigest()[:32]

    if not link_id:
        return HttpResponseBadRequest("Missing link id")

    try:
        link = Link.objects.get(pk=link_id)
    except Link.DoesNotExist:
        return JsonResponse({"detail": "Link not found"}, status=404)

    # создаём событие клика
    ClickEvent.objects.create(
        link=link,
        user_key=user_key or None,  # None, чтобы пустые не считались уникальными
        ip=_client_ip(request),
        ua=(request.META.get("HTTP_USER_AGENT", "")[:700]),
        created_at=now(),
    )

    # увеличиваем счётчик кликов у ссылки
    Link.objects.filter(pk=link.pk).update(clicks=F("clicks") + 1)

    return JsonResponse({"ok": True})


def link_stats(request, link_id: int):
    """
    Возвращает статистику по одной ссылке:
    - всего кликов
    - уникальных пользователей
    """
    qs = ClickEvent.objects.filter(link_id=link_id)
    total_clicks = qs.count()
    unique_users = (
        qs.exclude(user_key__isnull=True)
          .exclude(user_key="")
          .values("user_key")
          .distinct()
          .count()
    )
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
    - количество уникальных пользователей (по user_key)
    """
    total_projects = Project.objects.count()
    total_links = Link.objects.count()
    total_clicks = ClickEvent.objects.count()
    unique_users = (
        ClickEvent.objects
        .exclude(user_key__isnull=True)
        .exclude(user_key="")
        .values("user_key")
        .distinct()
        .count()
    )

    data = {
        "total_projects": total_projects,
        "total_links": total_links,
        "total_clicks": total_clicks,
        "unique_users": unique_users,
    }
    return JsonResponse(data)


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
        "unique_users": (
            qs.exclude(user_key__isnull=True)
              .exclude(user_key="")
              .values("user_key")
              .distinct()
              .count()
        ),
    }
    return JsonResponse(data)
