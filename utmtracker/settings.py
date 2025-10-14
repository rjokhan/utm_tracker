# utmtracker/settings.py
from pathlib import Path
import os

# === BASE ===
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-CHANGE_ME')
DEBUG = os.environ.get('DEBUG', '') == '1'

ALLOWED_HOSTS = [
    '89.39.95.53',
    'utm.qizilpomada.uz',
    'localhost',
    '127.0.0.1',
]
# можно расширить через переменную окружения
_extra = os.environ.get('EXTRA_ALLOWED_HOSTS', '')
if _extra:
    ALLOWED_HOSTS += [h.strip() for h in _extra.split(',') if h.strip()]

CSRF_TRUSTED_ORIGINS = [
    'http://89.39.95.53',
    'https://89.39.95.53',
    'utm.qizilpomada.uz',
    'utm.qizilpomada.uz',
]

# === APPS ===
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # External
    'corsheaders',

    # Local apps
    'core',
    'utmtracker',
]

# === MIDDLEWARE ===
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',          # статика
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',               # CORS перед CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# === URLS / WSGI / ASGI ===
ROOT_URLCONF = 'utmtracker.urls'
WSGI_APPLICATION = 'utmtracker.wsgi.application'
ASGI_APPLICATION = 'utmtracker.asgi.application'

# === DATABASE ===
# 1) Если задан DATABASE_URL (например, Postgres) — используем его
# 2) Иначе — SQLite по пути из ENV SQLITE_PATH (по умолчанию: BASE_DIR/db.sqlite3)
DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()
if DATABASE_URL:
    try:
        import dj_database_url  # pip install dj-database-url
        DATABASES = {
            'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)
        }
    except Exception:
        # fallback на SQLite, если dj-database-url не установлен
        SQLITE_PATH = os.environ.get('SQLITE_PATH', str(BASE_DIR / 'db.sqlite3'))
        DATABASES = {
            'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': SQLITE_PATH}
        }
else:
    SQLITE_PATH = os.environ.get('SQLITE_PATH', str(BASE_DIR / 'db.sqlite3'))
    DATABASES = {
        'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': SQLITE_PATH}
    }

# === AUTH ===
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# === INTERNATIONALIZATION ===
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Tashkent'
USE_I18N = True
USE_TZ = True

# === STATIC / MEDIA ===
STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'assets']
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
# Выносим media в внешнюю директорию, если задана переменная окружения
MEDIA_ROOT = os.environ.get('MEDIA_ROOT', str(BASE_DIR / 'media'))

# === SECURITY / COOKIES ===
CSRF_COOKIE_SAMESITE = 'None'
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'None'
SESSION_COOKIE_SECURE = True

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# === CORS ===
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = ['*']

# === TEMPLATES ===
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # HTML-шаблоны
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# === DEFAULTS ===
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# === CUSTOM (UTM Tracker auth logic) ===
QP_CREATOR_PASSWORD = os.environ.get('QP_CREATOR_PASSWORD', '')
QP_VIEWER_PASSWORD  = os.environ.get('QP_VIEWER_PASSWORD', '')

# === DEBUG helper ===
if DEBUG:
    INTERNAL_IPS = ['127.0.0.1']
    CORS_ALLOW_ALL_ORIGINS = True
    CSRF_COOKIE_SECURE = False
    SESSION_COOKIE_SECURE = False
