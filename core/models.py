# core/models.py
from django.db import models

class Project(models.Model):
    name = models.CharField(max_length=200)
    date_from = models.DateField(null=True, blank=True)
    date_to   = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # NEW: явная связь участников с проектами через промежуточную таблицу
    members = models.ManyToManyField('Member', through='ProjectMember', related_name='projects', blank=True)
    def __str__(self): return self.name

class Member(models.Model):
    name = models.CharField(max_length=200, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return self.name

class ProjectMember(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    member  = models.ForeignKey(Member, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'member')

    def __str__(self):
        return f'{self.member} in {self.project}'

class Link(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='links')
    owner   = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='links')
    name = models.CharField(max_length=200)
    target_url = models.URLField()
    clicks = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return f'{self.name} ({self.owner})'
