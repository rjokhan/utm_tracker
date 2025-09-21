# utmtracker/urls.py
from django.contrib import admin
from django.urls import path
from utmtracker import views as api          # API тут
from core import views as pages               # HTML-страницы тут

urlpatterns = [
    # ----- HTML PAGES -----
    path('', pages.index_page, name='index'),                          # Dashboard
    path('projects/', pages.projects_page, name='projects'),           # Список проектов
    path('project/<int:pk>/', pages.project_page, name='project'),     # Проект
    path('members/', pages.members_page, name='members'),              # Участники

    # ----- API (под префиксом /api/) -----
    path('api/login', api.login, name='api_login'),
    path('api/me', api.me, name='api_me'),

    path('api/summary', api.summary, name='api_summary'),
    path('api/leaderboard/global', api.global_leaderboard, name='api_global_leaderboard'),

    path('api/projects', api.projects_list, name='api_projects_list'),
    path('api/projects/create', api.project_create, name='api_project_create'),
    path('api/projects/<int:pk>', api.project_detail, name='api_project_detail'),
    path('api/projects/<int:pk>/leaderboard', api.project_leaderboard, name='api_project_leaderboard'),
    path('api/projects/<int:pk>/members', api.project_members, name='api_project_members'),
    path('api/projects/<int:pk>/members/add', api.project_add_member, name='api_project_add_member'),
    path('api/projects/<int:pk>/links/by-owner/<int:owner_id>', api.project_links_by_owner, name='api_project_links_by_owner'),
    path('api/projects/<int:pk>/links/create', api.project_link_create, name='api_project_link_create'),

    path('api/members', api.members_list, name='api_members_list'),
    path('api/members/create', api.member_create, name='api_member_create'),

    path('api/logout', api.logout, name='api_logout'),


    # редирект короткой ссылки
    path('go/<int:pk>', api.link_redirect, name='go'),
]
