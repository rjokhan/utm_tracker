#!/usr/bin/env bash
set -Eeuo pipefail

# ====== НАСТРОЙКИ ======
PROJECT_DIR="/opt/utmtracker"
REPO_URL="https://github.com/rjokhan/utm_tracker.git"
BRANCH="main"
PYTHON_BIN="/usr/bin/python3"
PORT="8002"                           # на каком порту слушает gunicorn
SERVICE_NAME="utmtracker"
ENV_FILE="/etc/utmtracker.env"        # сюда положим переменные окружения
DOMAIN="utm_tracker.qptolov.uz"       # твой домен (добавь IP в ALLOWED_HOSTS в settings.py)
# Пароли ролей (можно оставить пустыми и прописать позже в /etc/utmtracker.env)
CREATOR_PASS=""                       # QP_CREATOR_PASSWORD
VIEWER_PASS=""                        # QP_VIEWER_PASSWORD
# =======================

echo "[1/8] Подготовка каталогов"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/8] Код проекта: clone/pull"
if [ ! -d .git ]; then
  git init
  git remote add origin "$REPO_URL" || true
fi
git fetch origin "$BRANCH"
# Сбрасываем локальные изменения (если хочешь без reset, закомментируй следующие 2 строки):
git reset --hard "origin/$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

echo "[3/8] Python venv и зависимости"
if [ ! -d venv ]; then
  $PYTHON_BIN -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip wheel
# Если есть requirements.txt — поставим по нему, иначе — поставим базовый набор
if [ -f requirements.txt ]; then
  pip install -r requirements.txt
else
  pip install "Django>=4.2" gunicorn
fi

echo "[4/8] Среда для приложения (/etc/utmtracker.env)"
cat > "$ENV_FILE" <<EOF
DJANGO_SETTINGS_MODULE=utmtracker.settings
QP_CREATOR_PASSWORD=${CREATOR_PASS}
QP_VIEWER_PASSWORD=${VIEWER_PASS}
PYTHONUNBUFFERED=1
EOF
chmod 600 "$ENV_FILE"

echo "[5/8] Миграции и статика"
# На всякий случай — добавим IP/домен в ALLOWED_HOSTS, если ты это ещё не сделал в settings.py
# (скрипт ничего не ломает, просто напоминает)
python manage.py migrate --noinput || true
python manage.py collectstatic --noinput || true

echo "[6/8] Завершаем старые gunicorn (если висят) и выключаем старый сервис"
pkill -f "gunicorn .*${SERVICE_NAME}" || true
systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
systemctl disable "${SERVICE_NAME}" 2>/dev/null || true

echo "[7/8] Создаём systemd unit"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
cat > "$UNIT_FILE" <<EOF
[Unit]
Description=Gunicorn service for UTM Tracker
After=network.target

[Service]
Type=simple
User=root
Group=root
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${PROJECT_DIR}
# Важно: --chdir, чтобы модуль utmtracker находился гарантированно
ExecStartPre=${PROJECT_DIR}/venv/bin/python ${PROJECT_DIR}/manage.py migrate --noinput
ExecStartPre=${PROJECT_DIR}/venv/bin/python ${PROJECT_DIR}/manage.py collectstatic --noinput
ExecStart=${PROJECT_DIR}/venv/bin/gunicorn utmtracker.wsgi:application \\
  --chdir ${PROJECT_DIR} \\
  --bind 127.0.0.1:${PORT} \\
  --workers 3 \\
  --timeout 120

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
