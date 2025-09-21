// static/js/auth.js
(() => {
  const $ = (s) => document.querySelector(s);

  const els = {
    overlay: $('#loginOverlay'),
    modal:   $('#loginModal'),
    pass:    $('#loginPassword'),
    submit:  $('#loginSubmit'),
    brand:   document.querySelector('.brand img'), // <- логотип
  };

  const open  = () => { els.overlay?.classList.add('show'); els.modal?.classList.add('show'); };
  const close = ()  => { els.overlay?.classList.remove('show'); els.modal?.classList.remove('show'); };

  const setStatusBadges = (role) => {
    document.querySelectorAll('.status, #roleBadge').forEach(el => {
      if (role === 'creator') el.innerHTML = 'Status | <b>Creator</b> <span class="muted">(can edit)</span>';
      else if (role === 'viewer') el.innerHTML = 'Status | <b>Viewer</b> <span class="muted">(only view)</span>';
      else el.textContent = '';
    });
    const label = document.getElementById('roleLabel');
    const hint  = document.getElementById('roleHint');
    if (label && hint) {
      if (role === 'creator') { label.textContent = 'Creator'; hint.textContent  = '(can edit)'; }
      else if (role === 'viewer') { label.textContent = 'Viewer'; hint.textContent = '(only view)'; }
      else { label.textContent = ''; hint.textContent = ''; }
    }
  };

  async function init() {
    try {
      const { role } = await API.me();
      if (!role) {
        open();
      } else {
        setStatusBadges(role);
      }
    } catch (e) {
      console.error('auth init failed', e);
      open();
    }
  }

  // Сабмит пароля
  els.submit?.addEventListener('click', async () => {
    const pwd = (els.pass?.value || '').trim();
    if (!pwd) return;
    try {
      const { role } = await API.login(pwd);
      setStatusBadges(role);
      close();
    } catch (e) {
      els.pass.classList.add('shake');
      setTimeout(() => els.pass.classList.remove('shake'), 600);
    }
  });

  els.pass?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.submit?.click();
  });

  // === Выход по клику на лого ===
  els.brand?.addEventListener('click', async () => {
    try {
      await API.logout();
    } catch(e) {}
    open(); // снова покажем попап
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
