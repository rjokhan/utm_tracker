#!/usr/bin/env bash
set -euo pipefail

# ============ НАСТРОЙКИ (ОБЯЗАТЕЛЬНО ПРОВЕРЬ) ============
# Домен твоего сайта (для Nginx/SSL). Можно указать несколько через пробел.
DOMAIN="example.com"
# Путь/папка, куда деплоим код
APP_NAME="utmtracker"
BASE_DIR="/opt/${APP_NAME}"
# Git-репозиторий и ветка
REPO_URL="https://github.com/rjokhan/utm_tracker.git"
REPO_BRANCH="main"
# Имя Django-проекта (пакет, где wsgi.py). У тебя — utmtracker
DJANGO_PROJECT="utmtracker"
# Пользователь, от чьего имени хранятся файлы (обычно ты). Сокет и сервис — от www-data
APP_USER="${SUDO_USER:-$USER}"
# Включить выпуск SSL от Let's Encrypt (true/false)
ENABLE_SSL=true
# Email для certbot (если ENABLE_SSL=true)
LE_EMAIL="you@example.com"
# =========================================================

echo "[1/12] Обновляем пакеты и ставим зависимости..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3 python3-venv python3-pip \
  git nginx \
  ufw \
  jq

if $ENABLE_SSL; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
fi

echo "[2/12] Создаём каталоги..."
mkdir -p "$BASE_DIR"
cd "$BASE_DIR"

echo "[3/12] Клонируем/обновляем репозиторий..."
if [ ! -d "${BASE_DIR}/.git" ]; then
  git clone -b "$REPO_BRANCH" "$REPO_URL" "$BASE_DIR"
else
  git fetch --all
  git checkout "$REPO_BRANCH"
  git pull --ff-only
fi

echo "[4/12] Создаём/обновляем виртуальное окружение..."
if [ ! -d "${BASE_DIR}/venv" ]; then
  python3 -m venv "${BASE_DIR}/venv"
fi
source "${BASE_DIR}/venv/bin/activate"

# requirements.txt на случай если вдруг отсутствует (минимальный набор)
if [ ! -f "${BASE_DIR}/requirements.txt" ]; then
  cat > "${BASE_DIR}/requirements.txt" << 'REQ'
Django>=4.2,<5.0
gunicorn>=21.2
# Если будешь использовать Postgres — раскомментируй
# psycopg2-binary>=2.9
REQ
fi

echo "[5/12] pip install -r requirements.txt..."
pip install --upgrade pip
pip install -r requirements.txt

echo "[6/12] .env для Django (если отсутствует)..."
ENV_FILE="${BASE_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
  SECRET=$(python - <<'PY'
import secrets, string
alphabet = string.ascii_letters + string.digits + string.punctuation
print(''.join(secrets.choice(alphabet) for _ in range(50)))
PY
)
  cat > "$ENV_FILE" <<EOF
DJANGO_SECRET_KEY=${SECRET}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=${DOMAIN}
# Если нужен CSRF_TRUSTED_ORIGINS:
DJANGO_CSRF_TRUSTED_ORIGINS=https://${DOMAIN}
DJANGO_STATIC_ROOT=${BASE_DIR}/staticfiles
# Для SQLite ничего не нужно. Для Postgres добавь свои DSN переменные.
EOF
  chmod 600 "$ENV_FILE"
fi

echo "[7/12] Миграции и collectstatic..."
export DJANGO_SETTINGS_MODULE="${DJANGO_PROJECT}.settings"
python manage.py migrate --noinput
# Убедись, что в settings.py настроены STATIC_URL='/static/' и
# STATICFILES_DIRS включает assets/, а STATIC_ROOT — из .env (см. выше)
python manage.py collectstatic --noinput

echo "[8/12] Настраиваем systemd для Gunicorn..."
GUNI_SERVICE="/etc/systemd/system/gunicorn-${APP_NAME}.service"
cat > "$GUNI_SERVICE" <<EOF
[Unit]
Description=gunicorn for ${APP_NAME}
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=${BASE_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${BASE_DIR}/venv/bin/gunicorn --workers 3 --bind unix:${BASE_DIR}/gunicorn.sock ${DJANGO_PROJECT}.wsgi:application
Restart=always
RuntimeDirectory=gunicorn
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "gunicorn-${APP_NAME}.service"
systemctl restart "gunicorn-${APP_NAME}.service"

echo "[9/12] Права на проект и сокет..."
chown -R "${APP_USER}:www-data" "$BASE_DIR"
chmod -R 750 "$BASE_DIR"
# Сокет создаёт gunicorn от www-data. У nginx достаточно прав на чтение.

echo "[10/12] Nginx site..."
NGINX_SITE="/etc/nginx/sites-available/${APP_NAME}.conf"
cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Статика, которую собрал collectstatic
    location /static/ {
        alias ${BASE_DIR}/staticfiles/;
        access_log off;
        expires 30d;
    }

    # Проксирование в gunicorn по unix-сокету
    location / {
        include proxy_params;
        proxy_pass http://unix:${BASE_DIR}/gunicorn.sock;
    }

    client_max_body_size 20M;
}
EOF

ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/${APP_NAME}.conf"
# отключаем дефолтный конфиг
if [ -f /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
fi

echo "[11/12] Проверяем nginx и перезапускаем..."
nginx -t
systemctl reload nginx

echo "[12/12] Фаервол и (опционально) SSL..."
ufw allow 'Nginx Full' || true

if $ENABLE_SSL; then
  # Выпустит/обновит сертификаты и перезапишет server block под 443
  certbot --nginx -d ${DOMAIN} -m ${LE_EMAIL} --agree-tos --non-interactive --redirect || true
fi

echo "=============================================="
echo "Готово! Приложение задеплоено в ${BASE_DIR}"
echo "Проверь: http://${DOMAIN}"
echo "Сервис: systemctl status gunicorn-${APP_NAME}.service"
echo "=============================================="
