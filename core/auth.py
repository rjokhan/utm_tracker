from functools import wraps
from django.http import JsonResponse

VIEWER = 'viewer'
CREATOR = 'creator'

def require_viewer(fn):
    @wraps(fn)
    def _w(req, *a, **kw):
        if req.session.get('role') in (VIEWER, CREATOR):
            return fn(req, *a, **kw)
        return JsonResponse({'error':'unauthorized'}, status=401)
    return _w

def require_creator(fn):
    @wraps(fn)
    def _w(req, *a, **kw):
        if req.session.get('role') == CREATOR:
            return fn(req, *a, **kw)
        return JsonResponse({'error':'forbidden'}, status=403)
    return _w
