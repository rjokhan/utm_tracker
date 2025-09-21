# core/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),                     # Dashboard
    path('projects/', views.projects, name='projects'),      # все проекты
    path('project/<int:pk>/', views.project, name='project'),# один проект
    path('members/', views.members, name='members'),         # участники
]
