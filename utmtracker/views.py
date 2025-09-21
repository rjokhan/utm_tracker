# utmtracker/views.py
from __future__ import annotations
from django.http import JsonResponse, HttpResponseRedirect, HttpRequest
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, Sum, F
from django.shortcuts import get_object_or_404
from typing import Any, Dict

from core.models import Project, Member, Link, ProjectMember


# --------------------------
# Helpers
# --------------------------
def _role(request: HttpRequest) -> str:
    """Роль берём из сессии. По умолчанию viewer, чтобы безопаснее в проде."""
    return request.session.get("role", "viewer")

def _require_creator(request: HttpRequest) -> JsonResponse | None:
    """Возвращает JsonResponse-ошибку, если не creator. Иначе None."""
    if _role(request) != "creator":
        return JsonResponse({"error": "forbidden", "detail": "creator required"}, status=403)
    return None

def _project_brief(p: Project) -> Dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "date_from": p.date_from.isoformat() if p.date_from else None,
        "date_to": p.date_to.isoformat() if p.date_to else None,
    }

def _member_row(name: str, links: int, clicks: int, member_id: int | None = None) -> Dict[str, Any]:
    return {"id": member_id, "name": name, "links": links, "clicks": clicks or 0}


# --------------------------
# Auth (простая сессия)
# --------------------------
@csrf_exempt
@require_POST
def login(request: HttpRequest):
    """
    Упрощённый вход по паролю из попапа.
    JSON: { "password": "..." }
    Логика:
      - если password содержит 'creator' -> роль creator
      - иначе viewer
    В проде привяжешь к реальным паролям/модели.
    """
    import json
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        data = {}
    pwd = (data.get("password") or "").lower()
    role = "creator" if "creator" in pwd else "viewer"
    request.session["role"] = role
    return JsonResponse({"role": role})


@require_GET
def me(request: HttpRequest):
    # если роли в сессии нет — вернём null, чтобы фронт понял, что надо показать попап
    role = request.session.get("role")  # None | 'creator' | 'viewer'
    return JsonResponse({"role": role})



# --------------------------
# Summary / Dashboard
# --------------------------
@require_GET
def summary(request: HttpRequest):
    projects = Project.objects.count()
    links = Link.objects.count()
    clicks = Link.objects.aggregate(s=Sum("clicks"))["s"] or 0
    return JsonResponse({"projects": projects, "links": links, "clicks": clicks})


@require_GET
def global_leaderboard(request: HttpRequest):
    """
    Глобальный лидерборд по всем ссылкам: группируем по Member.
    Возвращает items: [{id,name,links,clicks}]
    """
    rows = (
        Link.objects.values("owner_id", "owner__name")
        .annotate(links=Count("id"), clicks=Sum("clicks"))
        .order_by("-clicks", "-links", "owner__name")
    )
    items = [_member_row(r["owner__name"], r["links"], r["clicks"], r["owner_id"]) for r in rows]
    return JsonResponse({"items": items})


# --------------------------
# Projects
# --------------------------
@require_GET
def projects_list(request: HttpRequest):
    items = [_project_brief(p) for p in Project.objects.order_by("-id")]
    return JsonResponse({"items": items})


@csrf_exempt
@require_POST
def project_create(request: HttpRequest):
    err = _require_creator(request)
    if err:
        return err
    import json
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        data = {}
    name = (data.get("name") or "").strip()
    date_from = data.get("date_from") or None
    date_to = data.get("date_to") or None
    if not name:
        return JsonResponse({"error": "name_required"}, status=400)
    p = Project.objects.create(name=name, date_from=date_from or None, date_to=date_to or None)
    return JsonResponse({"id": p.id})


@require_GET
def project_detail(request: HttpRequest, pk: int):
    p = get_object_or_404(Project, pk=pk)
    return JsonResponse(_project_brief(p))


@require_GET
def project_leaderboard(request: HttpRequest, pk: int):
    """
    Лидерборд внутри проекта: группируем ссылки этого проекта по Member.
    items: [{id,name,links,clicks}]
    """
    rows = (
        Link.objects.filter(project_id=pk)
        .values("owner_id", "owner__name")
        .annotate(links=Count("id"), clicks=Sum("clicks"))
        .order_by("-clicks", "-links", "owner__name")
    )
    items = [
        {"id": r["owner_id"], "name": r["owner__name"], "links": r["links"], "clicks": r["clicks"] or 0}
        for r in rows
    ]
    return JsonResponse({"items": items})


@require_GET
def project_members(request: HttpRequest, pk: int):
    """
    Все участники проекта из таблицы membership + их агрегаты (links/clicks) в рамках этого проекта.
    items: [{id,name,links,clicks}]
    """
    # убедимся, что проект существует
    get_object_or_404(Project, pk=pk)

    # члены проекта по таблице связей
    member_ids = list(
        ProjectMember.objects.filter(project_id=pk).values_list("member_id", flat=True)
    )
    members = Member.objects.filter(id__in=member_ids).order_by("name")

    # агрегаты по ссылкам внутри проекта
    agg = (
        Link.objects.filter(project_id=pk)
        .values("owner_id")
        .annotate(links=Count("id"), clicks=Sum("clicks"))
    )
    by_owner = {r["owner_id"]: r for r in agg}

    items = []
    for m in members:
        r = by_owner.get(m.id, {})
        items.append({
            "id": m.id,
            "name": m.name,
            "links": r.get("links", 0) or 0,
            "clicks": r.get("clicks", 0) or 0,
        })
    return JsonResponse({"items": items})


@csrf_exempt
@require_POST
def project_add_member(request: HttpRequest, pk: int):
    """
    Добавляет существующего Member в Project (через ProjectMember).
    body: { "member_id": <int> }
    """
    err = _require_creator(request)
    if err:
        return err

    import json
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        data = {}

    member_id = data.get("member_id")
    if not member_id:
        return JsonResponse({"error": "member_id_required"}, status=400)

    project = get_object_or_404(Project, pk=pk)
    member  = get_object_or_404(Member, pk=member_id)

    ProjectMember.objects.get_or_create(project=project, member=member)
    return JsonResponse({"ok": True})


# --------------------------
# Members (глобальный каталог)
# --------------------------
@require_GET
def members_list(request: HttpRequest):
    """
    Список всех участников (для страницы /members и для 'Add Member' в проект).
    items: [{id,name,active_projects,links,clicks,created_at}]
    active_projects и clicks считаем по всем ссылкам.
    """
    base = Member.objects.all().order_by("created_at")

    agg = (
        Link.objects.values("owner_id")
        .annotate(total_links=Count("id"), total_clicks=Sum("clicks"), projects=Count("project", distinct=True))
    )
    by_owner = {r["owner_id"]: r for r in agg}

    items = []
    for m in base:
        r = by_owner.get(m.id, {})
        items.append(
            {
                "id": m.id,
                "name": m.name,
                "active_projects": r.get("projects", 0),
                "links": r.get("total_links", 0),
                "clicks": r.get("total_clicks", 0) or 0,
                "created_at": m.created_at.isoformat(),
            }
        )
    return JsonResponse({"items": items})


@csrf_exempt
@require_POST
def member_create(request: HttpRequest):
    err = _require_creator(request)
    if err:
        return err
    import json
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        data = {}
    name = (data.get("name") or "").strip()
    if not name:
        return JsonResponse({"error": "name_required"}, status=400)
    m, created = Member.objects.get_or_create(name=name)
    return JsonResponse({"id": m.id, "created": created})


# --------------------------
# Links
# --------------------------
@require_GET
def project_links_by_owner(request: HttpRequest, pk: int, owner_id: int):
    """
    Ссылки участника в конкретном проекте.
    items: [{id, name, clicks, target_url}]
    """
    items = list(
        Link.objects.filter(project_id=pk, owner_id=owner_id)
        .order_by("-clicks", "-id")
        .values("id", "name", "clicks", "target_url")
    )
    for it in items:
        it["clicks"] = it["clicks"] or 0
    return JsonResponse({"items": items})


@csrf_exempt
@require_POST
def project_link_create(request: HttpRequest, pk: int):
    """
    Создание ссылки в проекте.
    JSON: { "owner_id": int, "name": str, "target_url": str }
    Возвращает { "id": <link_id> }
    """
    err = _require_creator(request)
    if err:
        return err
    import json
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        data = {}

    owner_id = data.get("owner_id")
    name = (data.get("name") or "").strip()
    target_url = (data.get("target_url") or "").strip()

    if not (owner_id and name and target_url):
        return JsonResponse({"error": "fields_required"}, status=400)

    project = get_object_or_404(Project, pk=pk)
    owner = get_object_or_404(Member, pk=owner_id)

    link = Link.objects.create(project=project, owner=owner, name=name, target_url=target_url, clicks=0)
    return JsonResponse({"id": link.id})


# --------------------------
# Redirect / Click counting
# --------------------------
@require_GET
def link_redirect(request: HttpRequest, pk: int):
    """
    Короткий урл: /go/<id>/
    Делает +1 к кликам и редиректит на target_url.
    """
    link = get_object_or_404(Link, pk=pk)
    Link.objects.filter(pk=pk).update(clicks=F("clicks") + 1)
    return HttpResponseRedirect(link.target_url)


@csrf_exempt
@require_POST
def logout(request: HttpRequest):
    """Просто очищаем роль в сессии."""
    request.session.pop("role", None)
    return JsonResponse({"ok": True})