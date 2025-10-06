// static/js/auth.js
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  const els = {
    overlay: $('#loginOverlay'),
    modal:   $('#loginModal'),
    input:   $('#loginUsername'),     // <-- username вместо password
    submit:  $('#loginSubmit'),
    brand:   $('.brand img'),         // клик по логотипу = logout
  };

  const open  = () => { els.overlay?.classList.add('show'); els.modal?.classList.add('show'); els.input?.focus(); };
  const close = ()  => { els.overlay?.classList.remove('show'); els.modal?.classList.remove('show'); };

  // Проставляем статус на страницах: .status, #roleBadge, #roleLabel/#roleHint
  const setStatusBadges = (role) => {
    // role из API: 'editor' | 'viewer' | 'anon'
    const label = role === 'editor' ? 'Creator' : role === 'viewer' ? 'Viewer' : '';
    const hint  = role === 'editor' ? '(can edit)' : role === 'viewer' ? '(only view)' : '';

    document.querySelectorAll('.status, #roleBadge').forEach(el => {
      if (!label) { el.textContent = ''; return; }
      el.innerHTML = `Status | <b>${label}</b> <span class="muted">${hint}</span>`;
    });

    const labelEl = $('#roleLabel');
    const hintEl  = $('#roleHint');
    if (labelEl) labelEl.textContent = label || '';
    if (hintEl)  hintEl.textContent  = hint || '';
  };

  // Не даём закрыть попап кликом по фону до логина
  els.overlay?.addEventListener('click', (e) => {
    // игнорируем — требуем явный ввод имени
    e.stopPropagation();
  });

  // Первичная инициализация
  async function init() {
    try {
      const me = await API.me(); // {auth, username?, role}
      if (!me.auth) {
        setStatusBadges('anon');
        open();
      } else {
        setStatusBadges(me.role);
        close();
      }
    } catch (e) {
      console.error('auth init failed', e);
      setStatusBadges('anon');
      open();
    }
  }

  // Сабмит username
  els.submit?.addEventListener('click', async () => {
    const username = (els.input?.value || '').trim();
    if (!username) {
      els.input?.classList.add('shake');
      setTimeout(() => els.input?.classList.remove('shake'), 500);
      els.input?.focus();
      return;
    }
    try {
      const res = await API.login(username); // {ok, username, role}
      setStatusBadges(res.role === 'editor' ? 'editor' : 'viewer');
      close();
      // Перегружаем, чтобы всё (кнопки-create и т.п.) отрисовалось с правами
      location.reload();
    } catch (e) {
      console.error(e);
      els.input?.classList.add('shake');
      setTimeout(() => els.input?.classList.remove('shake'), 500);
    }
  });

  // Enter для отправки
  els.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.submit?.click();
  });

  // === Выход по клику на лого ===
  els.brand?.addEventListener('click', async () => {
    try { await API.logout(); } catch (_) {}
    setStatusBadges('anon');
    // После выхода сразу просим ввести имя снова
    open();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
