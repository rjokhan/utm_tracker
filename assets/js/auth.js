// assets/js/auth.js
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  // попап регистрации показываем только на index
  const isIndex = location.pathname === '/' || location.pathname === '';
  const urlHasForceLogin = /\blogin=1\b/.test(location.search);

  // элементы
  const els = {
    // login (только index)
    loginOverlay: $('#loginOverlay'),
    loginModal:   $('#loginModal'),
    loginInput:   $('#loginName'),
    loginSubmit:  $('#loginSubmit'),

    // общий overlay на страницах (если есть)
    pageOverlay:  $('#overlay'),

    // логотип
    brand:        $('.brand'),
    brandImg:     $('.brand img'),
  };

  // ——— динамический logout-модал (есть в index или создаём на лету) ———
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

  // helpers
  const openLogin   = () => { els.loginOverlay?.classList.add('show'); els.loginModal?.classList.add('show'); setTimeout(()=>els.loginInput?.focus(), 40); };
  const closeLogin  = ()  => { els.loginOverlay?.classList.remove('show'); els.loginModal?.classList.remove('show'); };
  const openLogout  = ()  => { (els.pageOverlay || logoutOverlay)?.classList.add('show'); logoutModal?.classList.add('show'); };
  const closeLogout = ()  => { (els.pageOverlay || logoutOverlay)?.classList.remove('show'); logoutModal?.classList.remove('show'); };

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

  // CSRF
  const csrftoken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
  const postJSON = async (url, data) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrftoken},
      credentials: 'include',
      body: JSON.stringify(data || {})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  const getJSON = async (url) => {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  // init auth
  async function init() {
    try {
      const me = await getJSON('/api/me'); // {name, role, member_id} или пусто
      const isAuthed = !!(me && (me.name || me.username));
      if (isAuthed) {
        setStatusBadges(me.role);
        closeLogin();
      } else {
        setStatusBadges('anon');
        // форс-показать попап, если ?login=1 или это index
        if (isIndex && els.loginOverlay && els.loginModal) openLogin();
        else if (urlHasForceLogin && els.loginOverlay && els.loginModal) openLogin();
      }
    } catch (e) {
      console.error('auth init failed', e);
      setStatusBadges('anon');
      if ((isIndex || urlHasForceLogin) && els.loginOverlay && els.loginModal) openLogin();
    }
  }

  // login by name (index only)
  els.loginSubmit?.addEventListener('click', async () => {
    const name = (els.loginInput?.value || '').trim();
    if (!name) {
      els.loginInput?.classList.add('shake');
      setTimeout(() => els.loginInput?.classList.remove('shake'), 500);
      els.loginInput?.focus();
      return;
    }
    try {
      const res = await postJSON('/api/login', { name }); // backend создаёт Member
      setStatusBadges(res.role || 'creator');
      closeLogin();
      location.replace('/'); // чистим ?login=1, если был
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

  // не закрываем форму логина кликом по фону
  els.loginOverlay?.addEventListener('click', (e) => e.stopPropagation());

  // ——— LOGOUT по клику на логотип ———
  // делаем курсор "рука" на всякий случай
  if (els.brand) els.brand.style.cursor = 'pointer';
  if (els.brandImg) els.brandImg.style.cursor = 'pointer';

  const onBrandClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openLogout();
  };

  // вешаем слушатели и на контейнер, и на картинку
  els.brand?.addEventListener('click', onBrandClick);
  els.brandImg?.addEventListener('click', onBrandClick);

  // закрытие confirm кликом по фону
  (els.pageOverlay || logoutOverlay)?.addEventListener('click', () => {
    if (logoutModal?.classList.contains('show')) closeLogout();
  });

  // кнопки ДА/НЕТ
  logoutNo?.addEventListener('click', () => closeLogout());

  logoutYes?.addEventListener('click', async () => {
    try {
      await postJSON('/api/logout', {}); // гарантированно с CSRF + credentials
    } catch (_) {}
    closeLogout();
    setStatusBadges('anon');
    // всегда уводим на главную и форсим показ попапа регистрации
    location.href = '/?login=1';
  });

  // start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
