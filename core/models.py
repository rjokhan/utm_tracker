# core/models.py
from django.db import models


class Member(models.Model):
    """
    Пользователь фронта. По умолчанию viewer.
    Галочка is_editor в админке делает его editor.
    """
    name = models.CharField(max_length=200, unique=True)
    is_editor = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        verbose_name = "Пользователь сайта"
        verbose_name_plural = "Пользователи сайта"

    def __str__(self) -> str:
        return self.name

    @property
    def role(self) -> str:
        return "editor" if self.is_editor else "viewer"


class Project(models.Model):
    name = models.CharField(max_length=200)
    date_from = models.DateField(null=True, blank=True)
    date_to   = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Явная связь участников с проектами через промежуточную таблицу
    members = models.ManyToManyField(
        Member,
        through='ProjectMember',
        related_name='projects',
        blank=True
    )

    def __str__(self) -> str:
        return self.name


class ProjectMember(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    member  = models.ForeignKey(Member, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'member')

    def __str__(self) -> str:
        return f'{self.member} in {self.project}'


class Link(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='links')
    owner   = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='links')
    name = models.CharField(max_length=200)
    target_url = models.URLField()
    clicks = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.name} ({self.owner})'
