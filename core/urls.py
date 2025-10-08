from django.urls import path
from . import views

urlpatterns = [
    # ---------- Страницы ----------
    path('', views.index_page, name='index'),
    path('projects/', views.projects_page, name='projects'),
    path('project/<int:pk>/', views.project_page, name='project'),
    path('members/', views.members_page, name='members'),

    # ---------- API ----------
    path('api/track-click/', views.track_click, name='track_click'),
    path('api/stats/link/<int:link_id>/', views.link_stats, name='link_stats'),
    path('api/stats/project/', views.project_stats, name='project_stats'),
    # 👇 новый эндпоинт для одной конкретной сущности проекта
    path('api/stats/project/<int:project_id>/', views.project_stats_one, name='project_stats_one'),
]
