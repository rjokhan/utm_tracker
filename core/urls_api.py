# core/urls_api.py
from django.urls import path
from . import views_api as v

urlpatterns = [
    path('members', v.members_list),
    path('members/create', v.member_create),
]
