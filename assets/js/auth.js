// assets/js/auth.js
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  // --- 1) Всегда считаем пользователя Creator / Editor ---
  const setStatusBadges = () => {
    const label = 'Editor';
    const hint = '(can edit)';
    document.querySelectorAll('.status, #roleBadge').forEach(el => {
      el.innerHTML = `Status | <b>${label}</b> <span class="muted">${hint}</span>`;
    });
    const labelEl = $('#roleLabel');
    const hintEl = $('#roleHint');
    if (labelEl) labelEl.textContent = label;
    if (hintEl) hintEl.textContent = hint;
  };

  // --- 2) Подменяем API-методы, чтобы фронт всегда видел Editor ---
  const storedName = localStorage.getItem('qp_name') || 'Editor';
  const meObj = { name: storedName, role: 'editor', member_id: null };

  window.API = window.API || {};
  const original = {
    me: window.API.me,
    login: window.API.login,
    logout: window.API.logout,
  };

  window.API.me = async () => ({ ...meObj });
  window.API.login = async (newName) => {
    const nm = (newName || '').toString().trim();
    if (nm) localStorage.setItem('qp_name', nm);
    return { ...meObj, name: nm || storedName, ok: true };
  };
  window.API.logout = async () => {
    localStorage.removeItem('qp_name');
    return { ok: true };
  };

  // --- 3) Удаляем старые модалки логина, если где-то остались ---
  ['loginOverlay', 'loginModal', 'logoutModal', 'logoutOverlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  // --- 4) Делаем лого кликабельным — переход на главную ---
  const makeBrandClickable = () => {
    const brand = $('.brand');
    const brandImg = $('.brand img');
    if (brand) brand.style.cursor = 'pointer';
    if (brandImg) brandImg.style.cursor = 'pointer';
    const goHome = (e) => {
      e.preventDefault();
      e.stopPropagation();
      location.href = '/';
    };
    brand?.addEventListener('click', goHome);
    brandImg?.addEventListener('click', goHome);
  };

  // --- GO ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setStatusBadges();
      makeBrandClickable();
    });
  } else {
    setStatusBadges();
    makeBrandClickable();
  }
})();
