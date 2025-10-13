// assets/js/members.js
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const els = {
    list:        $('#list'),
    corner:      $('#corner'),
    roleBadge:   $('#roleBadge'),
    overlay:     $('#overlay'),
    modalAdd:    $('#modalAdd'),
    memberName:  $('#memberName'),
    btnAdd:      $('#btnAddMember'),
    btnCreate:   $('#createMember'),
    // KPI элементы
    kTeam:       $('#team-members'),
    kClicks:     $('#team-clicks'),
    kUniques:    $('#team-uniques'),
  };

  // --- state ---
  let creating = false;

  // --- helpers ---
  const open  = () => {
    els.overlay?.classList.add('show');
    els.modalAdd?.classList.add('show');
    setTimeout(() => els.memberName?.focus(), 50);
  };
  const close = ()  => {
    els.overlay?.classList.remove('show');
    els.modalAdd?.classList.remove('show');
  };

  const toast = (msg, type='ok') => {
    if (!els.corner) return;
    const el = document.createElement('div');
    el.className = `alert ${type} slide`;
    el.textContent = msg;
    els.corner.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  };

  const formatInt = (n) => {
    const v = Number(n || 0);
    return Number.isFinite(v) ? v.toLocaleString('en-US') : '0';
  };

  const safe = (v) => (v ?? '').toString();

  // ---------- KPI section ----------
  async function loadTeamStats() {
    try {
      // ✅ Исправленный эндпоинт
      const res = await fetch('/api/project-stats/', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('stats failed');
      const data = await res.json();

      if (els.kClicks)  els.kClicks.textContent  = formatInt(data.total_clicks ?? 0);
      if (els.kUniques) els.kUniques.textContent = formatInt(data.unique_users ?? 0);
    } catch (e) {
      console.warn('Failed to load stats', e);
      if (els.kClicks)  els.kClicks.textContent  = '—';
      if (els.kUniques) els.kUniques.textContent = '—';
    }
  }

  // Рендер строки участника
  function renderRow(idx, item) {
    const row = document.createElement('div');
    row.className = 'row';
    const name = safe(item.name);
    const activeIn = item.active_projects ?? item.activeIn ?? 0;
    const clicks   = item.clicks ?? 0;

    row.innerHTML = `
      <div class="idx">${idx}</div>
      <div class="name">${name}</div>
      <div class="meta">
        Active in <b>${formatInt(activeIn)}</b> projects&nbsp;&nbsp;&nbsp;
        Total clicks: <b>${formatInt(clicks)}</b>
      </div>
    `;
    return row;
  }

  function renderLoading() {
    if (!els.list) return;
    els.list.innerHTML = `
      <div class="row skeleton">
        <div class="idx">#</div>
        <div class="name">Loading…</div>
        <div class="meta">Please wait</div>
      </div>
    `;
  }

  // Загрузка и рендер списка
  async function loadAndRenderMembers() {
    if (!els.list) return;
    renderLoading();

    let items = [];
    try {
      const res = await API.membersAll();
      items = res?.items || [];
    } catch (e) {
      console.error(e);
      els.list.innerHTML = '';
      toast('Failed to load members', 'err');
      return;
    }

    // Порядок «старые → новые»
    const sorted = [...items].sort((a, b) => {
      const ca = Date.parse(a?.created_at ?? '') || 0;
      const cb = Date.parse(b?.created_at ?? '') || 0;
      return ca - cb;
    });

    els.list.innerHTML = '';
    if (!sorted.length) {
      const empty = document.createElement('div');
      empty.className = 'row empty';
      empty.textContent = 'No members yet';
      els.list.appendChild(empty);
      if (els.kTeam) els.kTeam.textContent = '0';
      return;
    }

    sorted.forEach((m, i) => {
      els.list.appendChild(renderRow(i + 1, m));
    });

    if (els.kTeam) els.kTeam.textContent = formatInt(sorted.length);
  }

  // Создание участника
  async function createMemberFlow() {
    const nm = safe(els.memberName?.value).trim();
    if (!nm) { toast('Enter name', 'err'); return; }
    if (creating) return;

    creating = true;
    els.btnCreate?.setAttribute('disabled', 'disabled');

    try {
      await API.memberCreate(nm);
      close();
      toast('SUCCESSFULLY CREATED', 'ok');
      await loadAndRenderMembers();
      await loadTeamStats(); // обновить KPI
    } catch (e) {
      console.error(e);
      toast('Error creating member', 'err');
    } finally {
      creating = false;
      els.btnCreate?.removeAttribute('disabled');
    }
  }

  // Инициализация (все — Editor)
  async function init() {
    // Бейдж статуса
    if (els.roleBadge) {
      els.roleBadge.textContent = 'Status | Editor (can edit)';
    }

    // Кнопка «Add New Team Member»
    els.btnAdd?.addEventListener('click', () => {
      if (els.memberName) els.memberName.value = '';
      open();
    });

    // Закрытие модалки
    els.overlay?.addEventListener('click', close);
    $$('[data-close]').forEach(b => b.addEventListener('click', close));

    // Submit
    els.btnCreate?.addEventListener('click', createMemberFlow);

    // Enter/Escape
    document.addEventListener('keydown', (ev) => {
      if (!els.modalAdd?.classList.contains('show')) return;
      if (ev.key === 'Enter') {
        ev.preventDefault();
        createMemberFlow();
      } else if (ev.key === 'Escape') {
        close();
      }
    });

    // Рендер списка и KPI
    await loadAndRenderMembers();
    await loadTeamStats();
  }

  // go
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
