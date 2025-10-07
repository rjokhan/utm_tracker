// assets/js/auth.js
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  // Попап регистрации показываем только на index
  const isIndex = location.pathname === '/' || location.pathname === '';

  const els = {
    // login
    overlay: $('#loginOverlay'),
    loginModal: $('#loginModal'),
    nameInput: $('#loginName'),
    loginSubmit: $('#loginSubmit'),

    // logout confirm
    logoutModal: $('#logoutModal'),
    logoutYes: $('#logoutYes'),
    logoutNo: $('#logoutNo'),

    // бренд-логотип
    brand: $('.brand img'),
  };

  // helpers
  const openLogin  = () => { els.overlay?.classList.add('show'); els.loginModal?.classList.add('show'); setTimeout(() => els.nameInput?.focus(), 40); };
  const closeLogin = ()  => { els.overlay?.classList.remove('show'); els.loginModal?.classList.remove('show'); };
  const openLogout = ()  => { els.overlay?.classList.add('show'); els.logoutModal?.classList.add('show'); };
  const closeLogout= ()  => { els.overlay?.classList.remove('show'); els.logoutModal?.classList.remove('show'); };

  const setStatusBadges = (role) => {
    const r = (role === 'editor') ? 'creator' : role;
    const label = r === 'creator' ? 'Creator' : r === 'viewer' ? 'Viewer' : '';
    const hint  = r === 'creator' ? '(can edit)' : r === 'viewer' ? '(only view)' : '';

    document.querySelectorAll('.status, #roleBadge').forEach(el => {
      if (!label) { el.textContent = ''; return; }
      el.innerHTML = `Status | <b>${label}</b> <span class="muted">${hint}</span>`;
    });
    const labelEl = $('#roleLabel');
    const hintEl  = $('#roleHint');
    if (labelEl) labelEl.textContent = label || '';
    if (hintEl)  hintEl.textContent  = hint || '';
  };

  // Не закрываем форму логина кликом по фону, но разрешаем закрывать модалку logout
  els.overlay?.addEventListener('click', (e) => {
    const loginOpen  = els.loginModal?.classList.contains('show');
    const logoutOpen = els.logoutModal?.classList.contains('show');
    if (logoutOpen) {
      // подтверждение выхода можно закрыть кликом по фону
      closeLogout();
    }
    if (loginOpen) {
      // логин — нельзя закрывать (требуем ввод имени)
      e.stopPropagation();
    }
  });

  async function init() {
    try {
      const me = await API.me(); // {name, role, member_id} или пусто
      const isAuthed = !!(me && (me.name || me.username));
      if (isAuthed) {
        setStatusBadges(me.role);
        // если уже авторизован — попап логина не показываем
        closeLogin();
      } else {
        setStatusBadges('anon');
        if (isIndex && els.loginModal && els.overlay) openLogin();
      }
    } catch (e) {
      console.error('auth init failed', e);
      setStatusBadges('anon');
      if (isIndex && els.loginModal && els.overlay) openLogin();
    }
  }

  // Сабмит имени
  els.loginSubmit?.addEventListener('click', async () => {
    const name = (els.nameInput?.value || '').trim();
    if (!name) {
      els.nameInput?.classList.add('shake');
      setTimeout(() => els.nameInput?.classList.remove('shake'), 500);
      els.nameInput?.focus();
      return;
    }
    try {
      const res = await API.login(name); // backend создаёт Member и кладёт роль
      setStatusBadges(res.role || 'creator');
      closeLogin();
      location.reload();
    } catch (e) {
      console.error(e);
      els.nameInput?.classList.add('shake');
      setTimeout(() => els.nameInput?.classList.remove('shake'), 500);
    }
  });

  // Enter в поле имени
  els.loginModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.loginSubmit?.click();
    if (e.key === 'Escape') closeLogin(); // (всё равно вернётся при init, если не авторизован)
  });

  // === Клик по логотипу: показываем подтверждение выхода ===
  els.brand?.addEventListener('click', () => {
    // если модалки логина нет (не index) — всё равно показываем confirm (модалка разметкой может быть только на index;
    // если её нет – сделаем прямой логаут с редиректом на /)
    if (els.logoutModal && els.overlay) {
      openLogout();
    } else {
      // Прямой логаут и редирект на главную (там покажется попап логина)
      API.logout().finally(() => { location.href = '/'; });
    }
  });

  // Кнопки подтверждения выхода
  els.logoutNo?.addEventListener('click', () => {
    closeLogout();
  });

  els.logoutYes?.addEventListener('click', async () => {
    try { await API.logout(); } catch (_) {}
    closeLogout();
    setStatusBadges('anon');
    // После выхода: если мы на index и попап логина есть — показать его;
    // иначе перебросить на index, где попап появится.
    if (isIndex && els.loginModal && els.overlay) {
      openLogin();
    } else {
      location.href = '/';
    }
  });

  // Старт
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
