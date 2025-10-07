# core/views_api.py
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from .models import Member

def _member_public_dict(m: Member):
    return {
        "id": m.id,
        "name": m.name,
        "is_editor": m.is_editor,
        "active_projects": m.projects.count(),
        "links": m.links.count(),
        "clicks": sum(l.clicks for l in m.links.all()),
        "created_at": m.created_at.isoformat(),
    }

def members_list(request):
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    qs = Member.objects.all().order_by("created_at")
    items = [_member_public_dict(m) for m in qs]
    return JsonResponse({"items": items})

@csrf_exempt
def member_create(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    name = (data.get("name") or "").strip()
    if not name:
        return JsonResponse({"detail": "Empty name"}, status=400)

    try:
        member, created = Member.objects.get_or_create(name=name)
        return JsonResponse({"id": member.id, "created": created})
    except IntegrityError:
        member = Member.objects.filter(name=name).first()
        return JsonResponse({"id": member.id, "created": False})
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)
