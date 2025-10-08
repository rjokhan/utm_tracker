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
    """
    Ссылка в рамках проекта. Хранит базовую статистику.
    Подробные клики записываются в ClickEvent.
    """
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='links')
    owner   = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='links')
    name = models.CharField(max_length=200)
    target_url = models.URLField()
    clicks = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.name} ({self.owner})'

    @property
    def unique_clicks(self) -> int:
        """Количество уникальных пользователей, кликнувших по ссылке"""
        return self.click_events.values('user_key').distinct().count()


class ClickEvent(models.Model):
    """
    Отдельное событие клика по ссылке.
    Сохраняет user_key, IP и User-Agent, чтобы считать total/unique клики.
    """
    link = models.ForeignKey(Link, on_delete=models.CASCADE, related_name='click_events')
    user_key = models.CharField(max_length=64, db_index=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    ua = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['link', 'user_key']),
            models.Index(fields=['created_at']),
        ]
        verbose_name = "Клик"
        verbose_name_plural = "Клики"

    def __str__(self) -> str:
        return f'{self.link.name} — {self.user_key}'
