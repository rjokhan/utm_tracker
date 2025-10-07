#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="/opt/utmtracker"
REPO_URL="https://github.com/rjokhan/utm_tracker.git"
BRANCH="main"
PYTHON_BIN="/usr/bin/python3"
PORT="8002"
SERVICE_NAME="utmtracker"
ENV_FILE="/etc/utmtracker.env"

# === ПЕРСИСТЕНТНЫЕ ДАННЫЕ ===
DATA_DIR="/var/lib/utmtracker"
SQLITE_PATH="${DATA_DIR}/db.sqlite3"
MEDIA_DIR="${DATA_DIR}/media"

SECRET_KEY="${DJANGO_SECRET_KEY:-changeme-please}"
DEBUG_FLAG="${DEBUG:-0}"

echo "[1/9] Каталоги"
mkdir -p "$PROJECT_DIR" "$DATA_DIR" "$MEDIA_DIR"
cd "$PROJECT_DIR"

echo "[2/9] Код"
if [ ! -d .git ]; then
  rm -rf ./*        # только при первом деплое
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" .
else
  git fetch origin "$BRANCH" --depth 1
  git reset --hard "origin/$BRANCH"
  git checkout -B "$BRANCH" "origin/$BRANCH"
fi

echo "[3/9] Venv"
[ -d venv ] || $PYTHON_BIN -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
if [ -f requirements.txt ]; then pip install -r requirements.txt; else pip install "Django>=4.2" gunicorn whitenoise django-cors-headers; fi

echo "[4/9] ENV (${ENV_FILE})"
cat > "$ENV_FILE" <<EOF
DJANGO_SETTINGS_MODULE=utmtracker.settings
DJANGO_SECRET_KEY=${SECRET_KEY}
DEBUG=${DEBUG_FLAG}
SQLITE_PATH=${SQLITE_PATH}
MEDIA_ROOT=${MEDIA_DIR}
PYTHONUNBUFFERED=1
EOF
chmod 600 "$ENV_FILE"

echo "[5/9] Перенос локальной БД (один раз)"
# если в проекте лежит старая db.sqlite3 и внешней ещё нет — переносим во внешнее хранилище
if [ -f "${PROJECT_DIR}/db.sqlite3" ] && [ ! -f "${SQLITE_PATH}" ]; then
  mv "${PROJECT_DIR}/db.sqlite3" "${SQLITE_PATH}"
fi
# гарантируем наличие файла БД
[ -f "${SQLITE_PATH}" ] || touch "${SQLITE_PATH}"
chmod 640 "${SQLITE_PATH}"

echo "[6/9] Миграции/статика"
./venv/bin/python manage.py migrate --noinput || true
./venv/bin/python manage.py collectstatic --noinput || true

echo "[7/9] Останавливаем старый сервис"
pkill -f "gunicorn .*${SERVICE_NAME}" || true
systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
systemctl disable "${SERVICE_NAME}" 2>/dev/null || true

echo "[8/9] systemd unit"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
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

echo "[9/9] Запуск"
sy
