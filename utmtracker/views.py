# utmtracker/views.py
from __future__ import annotations
from typing import Any, Dict, List

from django.http import JsonResponse, HttpResponseRedirect, HttpRequest
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, Sum, F
from django.shortcuts import get_object_or_404
from django.utils.timezone import now  # ⬅ добавлено
import hashlib                         # ⬅ добавлено

from core.models import Project, Member, Link, ProjectMember, ClickEvent  # ⬅ ClickEvent добавлен


# ==========================
# Helpers (session & roles)
# ==========================
def _current_user(request: HttpRequest) -> Member | None:
    uid = request.session.get("user_id")
    if not uid:
        return None
    try:
        return Member.objects.get(pk=uid)
    except Member.DoesNotExist:
        return None


def _role(request: HttpRequest) -> str:
    """'editor' | 'viewer' | 'anon'"""
    user = _current_user(request)
    if not user:
        return "anon"
    return "editor" if user.is_editor else "viewer"


def _require_editor(request: HttpRequest):
    """
    ВАЖНО: проверки роли отключены.
    Возвращаем None всегда, чтобы разрешить правки всем.
    Если когда-нибудь захочешь вернуть защиту — раскомментируй нижние строки.
    """
    # if _role(request) != "editor":
    #     return JsonResponse({"error": "forbidden", "detail": "editor required"}, status=403)
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


# ==========================
# Auth: username -> session
# ==========================
@csrf_exempt
@require_POST
def login(request: HttpRequest):
    """
    JSON: { "username": "..." }
    - если Member с таким именем есть — авторизуем
    - иначе создаём (по умолчанию viewer)
    - кладём user_id в сессию
    """
    import json
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        data = {}
    username = (data.get("username") or "").strip()
    if not username:
        return JsonResponse({"error": "username_required"}, status=400)

    member, _ = Member.objects.get_or_create(name=username)
    request.session["user_id"] = member.id

    return JsonResponse({
        "ok": True,
        "username": member.name,
        "role": "editor" if member.is_editor else "viewer",
        "is_editor": member.is_editor,
    })


@csrf_exempt
@require_POST
def logout(request: HttpRequest):
    """Полный выход: очищаем сессию."""
    request.session.flush()
    return JsonResponse({"ok": True})


@require_GET
def me(request: HttpRequest):
    """Текущий пользователь/роль из сессии (оставлено для совместимости)."""
    user = _current_user(request)
    if not user:
        return JsonResponse({"auth": False, "role": "anon"})
    return JsonResponse({
        "auth": True,
        "username": user.name,
        "role": "editor" if user.is_editor else "viewer",
        "is_editor": user.is_editor,
    })


# ==========================
# Summary / Dashboard
# ==========================
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
    items: [{id,name,links,clicks}]
    """
    rows = (
        Link.objects.values("owner_id", "owner__name")
        .annotate(links=Count("id"), clicks=Sum("clicks"))
        .order_by("-clicks", "-links", "owner__name")
    )
    items = [_member_row(r["owner__name"], r["links"], r["clicks"], r["owner_id"]) for r in rows]
    return JsonResponse({"items": items})


# ==========================
# Projects
# ==========================
@require_GET
def projects_list(request: HttpRequest):
    items = [_project_brief(p) for p in Project.objects.order_by("-id")]
    return JsonResponse({"items": items})


@csrf_exempt
@require_POST
def project_create(request: HttpRequest):
    err = _require_editor(request)
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
    Участники проекта (по таблице ProjectMember) + их агрегаты в рамках этого проекта.
    items: [{id,name,links,clicks}]
    """
    get_object_or_404(Project, pk=pk)

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

    items: List[Dict[str, Any]] = []
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
    err = _require_editor(request)
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


# ==========================
# Members (global)
# ==========================
@require_GET
def members_list(request: HttpRequest):
    """
    Список всех участников (для /members и для 'Add Member' в проект).
    items: [{id,name,is_editor,active_projects,links,clicks,created_at}]
    """
    base = Member.objects.all().order_by("created_at")

    agg = (
        Link.objects.values("owner_id")
        .annotate(
            total_links=Count("id"),
            total_clicks=Sum("clicks"),
            projects=Count("project", distinct=True),
        )
    )
    by_owner = {r["owner_id"]: r for r in agg}

    items: List[Dict[str, Any]] = []
    for m in base:
        r = by_owner.get(m.id, {})
        items.append({
            "id": m.id,
            "name": m.name,
            "is_editor": m.is_editor,
            "active_projects": r.get("projects", 0),
            "links": r.get("total_links", 0),
            "clicks": r.get("total_clicks", 0) or 0,
            "created_at": m.created_at.isoformat(),
        })
    return JsonResponse({"items": items})


@csrf_exempt
@require_POST
def member_create(request: HttpRequest):
    """
    Создание глобального участника.
    JSON: { "name": str } -> { "id": int, "created": bool }
    (проверка роли отключена)
    """
    err = _require_editor(request)
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


# ==========================
# Links
# ==========================
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
    err = _require_editor(request)
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
    # важно: если участник ещё не привязан к проекту, привяжем автоматом
    ProjectMember.objects.get_or_create(project=project, member=owner)

    return JsonResponse({"id": link.id})


# ==========================
# Redirect / Click counting
# ==========================
@require_GET
def link_redirect(request: HttpRequest, pk: int):
    """
    Короткий урл: /go/<id>
    Фиксируем ClickEvent (user_key, ip, ua) + увеличиваем счётчик, затем редирект.
    """
    link = get_object_or_404(Link, pk=pk)

    ua = request.META.get("HTTP_USER_AGENT", "")
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    ip = (xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR"))

    user_key = (request.GET.get("user") or "").strip()
    if not user_key:
        # стабильный фолбэк, если фронт не передал user
        user_key = hashlib.sha256(f"{ip}-{ua}".encode()).hexdigest()[:32]

    # записываем событие клика
    ClickEvent.objects.create(
        link=link,
        user_key=user_key or None,
        ip=ip,
        ua=ua[:700],
        created_at=now(),
    )

    # инкремент счётчика кликов у ссылки
    Link.objects.filter(pk=pk).update(clicks=F("clicks") + 1)

    return HttpResponseRedirect(link.target_url)
