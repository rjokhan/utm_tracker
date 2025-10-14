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

  const int = (v, def=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  const formatInt = (n) => int(n).toLocaleString('en-US');
  const safe = (v) => (v ?? '').toString();

  /**
   * Получаем статистику участника.
   * Поддерживаем разные варианты ключей с бэка:
   * - uniques: unique_clicks | unique_users | uniques | unique
   * - total:   total_clicks  | clicks
   */
  async function getMemberStats(memberId) {
    try {
      const r = await fetch(`/api/member-stats/${memberId}/`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const uniques = int(d?.unique_clicks ?? d?.unique_users ?? d?.uniques ?? d?.unique ?? 0);
      const total   = int(d?.total_clicks ?? d?.clicks ?? 0);
      return { unique_users: uniques, total_clicks: total };
    } catch {
      return { unique_users: 0, total_clicks: 0 };
    }
  }

  // ---------- KPI section ----------
  async function loadTeamStats() {
    try {
      // Суммарные метрики по всем ссылкам и участникам
      const res = await fetch('/api/project-stats/', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('stats failed');
      const data = await res.json();

      if (els.kClicks)  els.kClicks.textContent  = formatInt(data.total_clicks ?? 0);
      if (els.kUniques) els.kUniques.textContent = formatInt(data.unique_users ?? data.unique_clicks ?? 0);
      if (els.kTeam)    els.kTeam.textContent    = '—'; // реальное число проставим после списка
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

    const name      = safe(item.name);
    const activeIn  = int(item.active_projects ?? item.activeIn ?? 0);
    const uniques   = int(item.unique_users ?? 0); // уже нормализовано при обогащении
    const clicks    = int(item.total_clicks ?? item.clicks ?? 0);

    row.innerHTML = `
      <div class="idx">${idx}</div>
      <div class="name">${name}</div>
      <div class="meta">
        Active in <b>${formatInt(activeIn)}</b> projects&nbsp;&nbsp;&nbsp;
        Unique clicks: <b>${formatInt(uniques)}</b>&nbsp;&nbsp;&nbsp;
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

    // Если пусто
    if (!items.length) {
      els.list.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'row empty';
      empty.textContent = 'No members yet';
      els.list.appendChild(empty);
      if (els.kTeam) els.kTeam.textContent = '0';
      return;
    }

    // Подтягиваем индивидуальные метрики (unique + clicks) параллельно
    const stats = await Promise.all(items.map(m => getMemberStats(m.id)));

    // Обогащаем исходные элементы
    const enriched = items.map((m, i) => {
      const st = stats[i] || { unique_users: 0, total_clicks: 0 };
      const clicksFallback  = int(m.clicks ?? 0);
      const uniquesFallback = int(m.unique_users ?? m.unique_clicks ?? m.uniques ?? 0);
      return {
        ...m,
        unique_users: int(st.unique_users ?? uniquesFallback ?? 0),
        total_clicks: Number.isFinite(st.total_clicks) ? st.total_clicks : clicksFallback,
      };
    });

    // Сортировка:
    // 1) по total_clicks DESC
    // 2) по unique_users DESC
    // 3) стабилизатор по created_at ASC
    const sorted = enriched.sort((a, b) => {
      const c1 = int(b.total_clicks) - int(a.total_clicks);
      if (c1 !== 0) return c1;
      const c2 = int(b.unique_users) - int(a.unique_users);
      if (c2 !== 0) return c2;
      const ta = Date.parse(a?.created_at ?? '') || 0;
      const tb = Date.parse(b?.created_at ?? '') || 0;
      return ta - tb;
    });

    // Рендер
    els.list.innerHTML = '';
    sorted.forEach((m, i) => {
      const row = renderRow(i + 1, m);
      els.list.appendChild(row);
    });

    // Помечаем аутсайдера (последний после сортировки)
    const last = els.list.lastElementChild;
    if (last) last.classList.add('outsider');

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

  // Инициализация
  async function init() {
    // Если есть бейдж роли в разметке
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
