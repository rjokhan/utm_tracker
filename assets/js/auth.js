// assets/js/auth.js
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  // Попап регистрации показываем только на index
  const isIndex = location.pathname === '/' || location.pathname === '';

  // --- ЭЛЕМЕНТЫ -------------------------------------------------------------
  const els = {
    // login (только index)
    loginOverlay: $('#loginOverlay'),
    loginModal:   $('#loginModal'),
    loginInput:   $('#loginName'),
    loginSubmit:  $('#loginSubmit'),

    // общие (могут отсутствовать)
    pageOverlay:  $('#overlay'),         // например, в members.html
    brand:        $('.brand img'),
  };

  // --- ДИН. СОЗДАНИЕ МОДАЛКИ LOGOUT ----------------------------------------
  // используем pageOverlay (#overlay) если он есть, иначе создадим свой
  let logoutOverlay = els.pageOverlay || $('#logoutOverlay');
  if (!logoutOverlay) {
    logoutOverlay = document.createElement('div');
    logoutOverlay.id = 'logoutOverlay';
    logoutOverlay.className = 'overlay';
    document.body.appendChild(logoutOverlay);
  }

  let logoutModal = $('#logoutModal');
  if (!logoutModal) {
    logoutModal = document.createElement('div');
    logoutModal.id = 'logoutModal';
    logoutModal.className = 'modal modal-white';
    logoutModal.style.maxWidth = '420px';
    logoutModal.innerHTML = `
      <h3 class="modal-title dark">ЖЕЛАЕТЕ ВЫЙТИ?</h3>
      <div class="modal-actions">
        <button id="logoutYes" class="btn">ДА</button>
        <button id="logoutNo" class="btn ghost" type="button">НЕТ</button>
      </div>
    `;
    document.body.appendChild(logoutModal);
  }

  const logoutYes = $('#logoutYes');
  const logoutNo  = $('#logoutNo');

  // --- ПОМОЩНИКИ ------------------------------------------------------------
  const openLogin   = () => { els.loginOverlay?.classList.add('show'); els.loginModal?.classList.add('show'); setTimeout(()=>els.loginInput?.focus(), 40); };
  const closeLogin  = () => { els.loginOverlay?.classList.remove('show'); els.loginModal?.classList.remove('show'); };

  const openLogout  = () => { (els.pageOverlay || logoutOverlay)?.classList.add('show'); logoutModal?.classList.add('show'); };
  const closeLogout = () => { (els.pageOverlay || logoutOverlay)?.classList.remove('show'); logoutModal?.classList.remove('show'); };

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

  // --- ИНИЦИАЛИЗАЦИЯ АВТОРИЗАЦИИ -------------------------------------------
  async function init() {
    try {
      const me = await API.me(); // {name, role, member_id} или пусто
      const isAuthed = !!(me && (me.name || me.username));
      if (isAuthed) {
        setStatusBadges(me.role);
        closeLogin();
      } else {
        setStatusBadges('anon');
        if (isIndex && els.loginOverlay && els.loginModal) openLogin();
      }
    } catch (e) {
      console.error('auth init failed', e);
      setStatusBadges('anon');
      if (isIndex && els.loginOverlay && els.loginModal) openLogin();
    }
  }

  // --- ЛОГИН ПО ИМЕНИ (ТОЛЬКО INDEX) ---------------------------------------
  els.loginSubmit?.addEventListener('click', async () => {
    const name = (els.loginInput?.value || '').trim();
    if (!name) {
      els.loginInput?.classList.add('shake');
      setTimeout(() => els.loginInput?.classList.remove('shake'), 500);
      els.loginInput?.focus();
      return;
    }
    try {
      const res = await API.login(name); // backend создаёт Member и кладёт роль
      setStatusBadges(res.role || 'creator');
      closeLogin();
      location.reload();
    } catch (e) {
      console.error(e);
      els.loginInput?.classList.add('shake');
      setTimeout(() => els.loginInput?.classList.remove('shake'), 500);
    }
  });

  els.loginModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.loginSubmit?.click();
    if (e.key === 'Escape') closeLogin();
  });

  // не закрываем форму логина кликом по фону (требуем ввод имени)
  els.loginOverlay?.addEventListener('click', (e) => e.stopPropagation());

  // --- ЛОГАУТ: КЛИК ПО ЛОГОТИПУ --------------------------------------------
  els.brand?.addEventListener('click', () => {
    // всегда показываем confirm (модалка уже есть или создана)
    openLogout();
  });

  // закрытие confirm кликом по фону
  (els.pageOverlay || logoutOverlay)?.addEventListener('click', () => {
    if (logoutModal?.classList.contains('show')) closeLogout();
  });

  logoutNo?.addEventListener('click', () => closeLogout());

  logoutYes?.addEventListener('click', async () => {
    try { await API.logout(); } catch (_) {}
    closeLogout();
    setStatusBadges('anon');
    if (isIndex && els.loginOverlay && els.loginModal) {
      openLogin();
    } else {
      location.href = '/';
    }
  });

  // --- GO -------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
