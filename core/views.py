from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, F
from django.utils.timezone import now

from .models import Link, ClickEvent


# ---------- PAGES ----------
def index_page(request):
    return render(request, 'index.html')

def projects_page(request):
    return render(request, 'projects.html')

def project_page(request, pk: int):
    return render(request, 'project.html', {"project_id": pk})

def members_page(request):
    return render(request, 'members.html')


# ---------- HELPERS ----------
def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ---------- API ----------
@csrf_exempt
def track_click(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    link_id = request.POST.get("link_id")
    user_key = request.POST.get("user_key")

    if not link_id or not user_key:
        return HttpResponseBadRequest("Missing link_id or user_key")

    try:
        link = Link.objects.get(pk=link_id)
    except Link.DoesNotExist:
        return HttpResponseBadRequest("Bad link_id")

    ClickEvent.objects.create(
        link=link,
        user_key=user_key[:64],
        ip=_client_ip(request),
        ua=(request.META.get("HTTP_USER_AGENT", "")[:700]),
        created_at=now(),
    )
    Link.objects.filter(pk=link.pk).update(clicks=F("clicks") + 1)
    return JsonResponse({"ok": True})


def link_stats(request, link_id: int):
    try:
        link = Link.objects.get(pk=link_id)
    except Link.DoesNotExist:
        return HttpResponseBadRequest("Bad link_id")

    qs = ClickEvent.objects.filter(link_id=link_id)
    data = {
        "link_id": link_id,
        "name": link.name,
        "total_clicks": qs.count(),
        "unique_users": qs.values("user_key").distinct().count(),
        "fast_total_clicks": link.clicks,
    }
    return JsonResponse(data)


def project_stats(request):
    total = ClickEvent.objects.count()
    uniques = ClickEvent.objects.values("user_key").distinct().count()

    by_link = (
        ClickEvent.objects
        .values("link_id", "link__name")
        .annotate(
            total_clicks=Count("id"),
            unique_users=Count("user_key", distinct=True),
        )
        .order_by("-total_clicks")
    )

    return JsonResponse({
        "total_clicks": total,
        "unique_users": uniques,
        "by_link": list(by_link),
    })


# 👇 NEW: статистика по одному проекту
def project_stats_one(request, project_id: int):
    """
    GET: /api/stats/project/<project_id>/
    Возвращает total_clicks и unique_users только для ссылок данного проекта.
    """
    qs = ClickEvent.objects.filter(link__project_id=project_id)
    data = {
        "project_id": project_id,
        "total_clicks": qs.count(),
        "unique_users": qs.values("user_key").distinct().count(),
    }
    return JsonResponse(data)
