# core/views.py
from django.shortcuts import render

def index_page(request):
    # dashboard
    return render(request, 'index.html')

def projects_page(request):
    return render(request, 'projects.html')

def project_page(request, pk: int):
    # можно передать id в шаблон, если надо
    return render(request, 'project.html', {"project_id": pk})

def members_page(request):
    return render(request, 'members.html')
