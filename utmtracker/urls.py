from django.contrib import admin
from django.urls import path
from utmtracker import views as api
from core import views as pages

urlpatterns = [
    # HTML
    path('', pages.index_page, name='index'),
    path('projects/', pages.projects_page, name='projects'),
    path('project/<int:pk>/', pages.project_page, name='project'),
    path('members/', pages.members_page, name='members'),

    # ADMIN
    path('admin/', admin.site.urls),   # ← добавь это

    # AUTH
    path('api/login', api.login, name='api_login'),
    path('api/logout', api.logout, name='api_logout'),
    path('api/me', api.me, name='api_me'),

    # DASHBOARD
    path('api/summary', api.summary, name='api_summary'),
    path('api/leaderboard/global', api.global_leaderboard, name='api_global_leaderboard'),

    # PROJECTS
    path('api/projects', api.projects_list, name='api_projects_list'),
    path('api/projects/create', api.project_create, name='api_project_create'),
    path('api/projects/<int:pk>', api.project_detail, name='api_project_detail'),
    path('api/projects/<int:pk>/leaderboard', api.project_leaderboard, name='api_project_leaderboard'),
    path('api/projects/<int:pk>/members', api.project_members, name='api_project_members'),
    path('api/projects/<int:pk>/members/add', api.project_add_member, name='api_project_add_member'),
    path('api/projects/<int:pk>/links/by-owner/<int:owner_id>', api.project_links_by_owner, name='api_project_links_by_owner'),
    path('api/projects/<int:pk>/links/create', api.project_link_create, name='api_project_link_create'),

    # MEMBERS
    path('api/members', api.members_list, name='api_members_list'),
    path('api/members/create', api.member_create, name='api_member_create'),

    # REDIRECT
    path('go/<int:pk>', api.link_redirect, name='go'),
]
