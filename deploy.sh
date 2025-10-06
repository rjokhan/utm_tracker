#!/usr/bin/env bash
set -Eeuo pipefail

# ====== НАСТРОЙКИ ======
PROJECT_DIR="/opt/utmtracker"
REPO_URL="https://github.com/rjokhan/utm_tracker.git"
BRANCH="main"
PYTHON_BIN="/usr/bin/python3"
PORT="8002"
SERVICE_NAME="utmtracker"
ENV_FILE="/etc/utmtracker.env"
DOMAIN="utm-tracker.qptolov.uz"       # ← дефис, не подчёркивание
CREATOR_PASS=""                       # QP_CREATOR_PASSWORD
VIEWER_PASS=""                        # QP_VIEWER_PASSWORD
SECRET_KEY="${DJANGO_SECRET_KEY:-changeme-please}"
DEBUG_FLAG="${DEBUG:-0}"              # 0|1
# =======================

echo "[1/8] Подготовка каталогов"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/8] Код проекта: clone/pull"
if [ ! -d .git ]; then
  rm -rf ./*
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" .
else
  git fetch origin "$BRANCH" --depth 1
  git reset --hard "origin/$BRANCH"
  git checkout -B "$BRANCH" "origin/$BRANCH"
fi

echo "[3/8] Python venv и зависимости"
if [ ! -d venv ]; then
  $PYTHON_BIN -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip wheel

if [ -f requirements.txt ]; then
  pip install -r requirements.txt
else
  # базовый набор, чтобы работал WhiteNoise и CORS
  pip install "Django>=4.2" gunicorn whitenoise django-cors-headers
fi

echo "[4/8] Среда для приложения ($ENV_FILE)"
cat > "$ENV_FILE" <<EOF
DJANGO_SETTINGS_MODULE=utmtracker.settings
DJANGO_SECRET_KEY=${SECRET_KEY}
DEBUG=${DEBUG_FLAG}
QP_CREATOR_PASSWORD=${CREATOR_PASS}
QP_VIEWER_PASSWORD=${VIEWER_PASS}
PYTHONUNBUFFERED=1
EOF
chmod 600 "$ENV_FILE"

echo "[5/8] Миграции и статика"
./venv/bin/python manage.py migrate --noinput || true
./venv/bin/python manage.py collectstatic --noinput || true

echo "[6/8] Останавливаем старый сервис (если есть)"
pkill -f "gunicorn .*${SERVICE_NAME}" || true
systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
systemctl disable "${SERVICE_NAME}" 2>/dev/null || true

echo "[7/8] Создаём systemd unit"
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

echo "[8/8] Запуск сервиса"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
sleep 1
systemctl status "${SERVICE_NAME}" --no-pager -l || true

echo "Готово. Gunicorn слушает 127.0.0.1:${PORT}"
echo "Проверка:  ss -tulpn | grep ${PORT}  и  journalctl -u ${SERVICE_NAME} -n 100 -f"
