#!/usr/bin/env bash
set -Eeuo pipefail

# ====== НАСТРОЙКИ ======
PROJECT_DIR="/opt/utmtracker"
REPO_URL="https://github.com/rjokhan/utm_tracker.git"
BRANCH="main"
PYTHON_BIN="/usr/bin/python3"
PORT="8002"
SERVICE_NAME="utmtracker"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_FILE="/etc/utmtracker.env"

# Пути к БД и бэкапам (вне репозитория)
SQLITE_DIR="/var/lib/utmtracker"
SQLITE_PATH="${SQLITE_DIR}/db.sqlite3"
BACKUP_DIR="/var/backups/utmtracker"

DOMAIN="utm.qizilpomada.uz"
CREATOR_PASS=""
VIEWER_PASS=""
SECRET_KEY="${DJANGO_SECRET_KEY:-changeme-please}"
DEBUG_FLAG="${DEBUG:-0}"
# =======================

echo "[0/9] Проверяем наличие sqlite3 (для бэкапов)"
if ! command -v sqlite3 >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y sqlite3
fi

echo "[1/9] Подготовка каталогов"
mkdir -p "$PROJECT_DIR" "$SQLITE_DIR" "$BACKUP_DIR"
cd "$PROJECT_DIR"

echo "[2/9] Код проекта: clone/pull"
if [ ! -d .git ]; then
  rm -rf ./*
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" .
else
  git fetch origin "$BRANCH" --depth 1
  git reset --hard "origin/$BRANCH"
  git checkout -B "$BRANCH" "origin/$BRANCH"
fi

echo "[3/9] Python venv и зависимости"
if [ ! -d venv ]; then
  $PYTHON_BIN -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip wheel
if [ -f requirements.txt ]; then
  pip install -r requirements.txt
else
  pip install "Django>=4.2" gunicorn whitenoise django-cors-headers
fi

echo "[4/9] Окружение ($ENV_FILE)"
# гарантируем наличие файла, убираем дубликаты SQLITE_PATH
touch "$ENV_FILE"
sed -i '/^SQLITE_PATH=/d' "$ENV_FILE"
cat > "$ENV_FILE" <<EOF
DJANGO_SETTINGS_MODULE=utmtracker.settings
DJANGO_SECRET_KEY=${SECRET_KEY}
DEBUG=${DEBUG_FLAG}
QP_CREATOR_PASSWORD=${CREATOR_PASS}
QP_VIEWER_PASSWORD=${VIEWER_PASS}
PYTHONUNBUFFERED=1
SQLITE_PATH=${SQLITE_PATH}
EOF
chmod 600 "$ENV_FILE"

echo "[5/9] Подготовка БД и бэкап"
# создадим пустую БД, если её нет
if [ ! -f "$SQLITE_PATH" ]; then
  echo "→ База не найдена — создаю новую: $SQLITE_PATH"
  install -m 0640 -o www-data -g www-data /dev/null "$SQLITE_PATH"
fi
# бэкап перед миграциями (только если есть утилита sqlite3)
if command -v sqlite3 >/dev/null 2>&1; then
  BK="${BACKUP_DIR}/db-$(date +%F-%H%M).sqlite3"
  echo "→ Бэкап базы в: $BK"
  sqlite3 "$SQLITE_PATH" ".backup '$BK'"
fi
chown -R www-data:www-data "$SQLITE_DIR"

echo "[6/9] Миграции и статика"
# запускаем manage.py в том же окружении, что и сервис
env $(cat "$ENV_FILE" | xargs) ./venv/bin/python manage.py migrate --noinput || true
env $(cat "$ENV_FILE" | xargs) ./venv/bin/python manage.py collectstatic --noinput || true

echo "[7/9] Останавливаем предыдущий сервис (если есть)"
pkill -f "gunicorn .*${SERVICE_NAME}" || true
systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
systemctl disable "${SERVICE_NAME}" 2>/dev/null || true

echo "[8/9] Создаём/обновляем systemd unit"
cat > "$UNIT_FILE" <<EOF
[Unit]
Description=Gunicorn service for UTM Tracker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${PROJECT_DIR}
# safety: применяем миграции и статику при старте
ExecStartPre=${PROJECT_DIR}/venv/bin/python ${PROJECT_DIR}/manage.py migrate --noinput
ExecStartPre=${PROJECT_DIR}/venv/bin/python ${PROJECT_DIR}/manage.py collectstatic --noinput
ExecStart=${PROJECT_DIR}/venv/bin/gunicorn utmtracker.wsgi:application \\
  --chdir ${PROJECT_DIR} \\
  --bind 127.0.0.1:${PORT} \\
  --workers 3 \\
  --timeout 120 \\
  --access-logfile - \\
  --error-logfile -

Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo "[9/9] Перезапуск сервиса"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
sleep 1
systemctl status "${SERVICE_NAME}" --no-pager -l || true

echo "✅ Готово."
echo "• Gunicorn: 127.0.0.1:${PORT}"
echo "• База:     ${SQLITE_PATH}"
echo "• Бэкапы:   ${BACKUP_DIR}"
echo "Проверка: ss -tulpn | grep ${PORT}  &&  journalctl -u ${SERVICE_NAME} -n 100 -f"
