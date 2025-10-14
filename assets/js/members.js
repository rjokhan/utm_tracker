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
    // KPI
    kTeam:       $('#team-members'),
    kClicks:     $('#team-clicks'),
    kUniques:    $('#team-uniques'),
  };

  let creating = false;

  // ---------- utils ----------
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

  const open  = () => {
    els.overlay?.classList.add('show');
    els.modalAdd?.classList.add('show');
    setTimeout(() => els.memberName?.focus(), 50);
  };
  const close = ()  => {
    els.overlay?.classList.remove('show');
    els.modalAdd?.classList.remove('show');
  };

  // ---------- API fallbacks ----------
  async function fetchLinksByOwner(ownerId) {
    // Пытаемся разными способами — под разные реализации api.js
    try {
      if (window.API?.linksByOwnerAll) {
        const { items = [] } = await API.linksByOwnerAll(ownerId);
        return items;
      }
      if (window.API?.linksByOwner) {
        // вариант без projectId
        try {
          const r = await API.linksByOwner(undefined, ownerId);
          return r?.items || [];
        } catch {}
        // вариант с null projectId
        try {
          const r = await API.linksByOwner(null, ownerId);
          return r?.items || [];
        } catch {}
        // вариант только ownerId
        const r = await API.linksByOwner(ownerId);
        return r?.items || [];
      }
    } catch {}
    return [];
  }

  async function fetchLinkUnique(linkId) {
    try {
      const r = await fetch(`/api/link-stats/${linkId}/`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('bad');
      const d = await r.json();
      return int(d?.unique_users ?? d?.unique ?? 0);
    } catch {
      return 0;
    }
  }

  /**
   * Метрики участника:
   * 1) пробуем /api/member-stats/<id>/
   * 2) если пусто — собираем через список ссылок участника (+ /api/link-stats/<link_id>/)
   */
  async function getMemberStats(memberId) {
    // 1) основной эндпоинт
    try {
      const r = await fetch(`/api/member-stats/${memberId}/`, { credentials: 'same-origin' });
      if (r.ok) {
        const d = await r.json();
        const uniques = int(d?.unique_clicks ?? d?.unique_users ?? d?.uniques ?? d?.unique ?? 0);
        const total   = int(d?.total_clicks ?? d?.clicks ?? 0);
        if (uniques || total) return { unique_users: uniques, total_clicks: total };
      }
    } catch {}

    // 2) фоллбек через ссылки
    try {
      const links = await fetchLinksByOwner(memberId);
      if (!links.length) return { unique_users: 0, total_clicks: 0 };
      const total = links.reduce((s, l) => s + int(l?.clicks ?? 0), 0);
      // Сумма уникальных по ссылкам (может немного завышать, но это лучший клиентский фоллбек)
      const uniquesArr = await Promise.all(links.map(l => fetchLinkUnique(l.id)));
      const uniques = uniquesArr.reduce((s, u) => s + int(u), 0);
      return { unique_users: uniques, total_clicks: total };
    } catch {
      return { unique_users: 0, total_clicks: 0 };
    }
  }

  // ---------- KPI (глобальные суммы) ----------
  async function loadTeamStats() {
    try {
      const res = await fetch('/api/project-stats/', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('stats failed');
      const data = await res.json();

      if (els.kClicks)  els.kClicks.textContent  = formatInt(data.total_clicks ?? 0);
      if (els.kUniques) els.kUniques.textContent = formatInt(data.unique_users ?? data.unique_clicks ?? 0);
      // kTeam НЕ трогаем здесь — его выставит список участников
    } catch (e) {
      console.warn('Failed to load team KPI', e);
      if (els.kClicks)  els.kClicks.textContent  = '—';
      if (els.kUniques) els.kUniques.textContent = '—';
    }
  }

  // ---------- рендер одной строки ----------
  function renderRow(idx, item) {
    const row = document.createElement('div');
    row.className = 'row';

    const name      = safe(item.name);
    const activeIn  = int(item.active_projects ?? item.activeIn ?? 0);
    const uniques   = int(item.unique_users ?? item.unique_clicks ?? item.uniques ?? 0);
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

  // ---------- загрузка и рендер списка ----------
  async function loadAndRenderMembers() {
    if (!els.list) return;
    renderLoading();

    let items = [];
    try {
      const res = await API.membersAll();
      items = Array.isArray(res) ? res : (res?.items || []);
    } catch (e) {
      console.error(e);
      els.list.innerHTML = '';
      toast('Failed to load members', 'err');
      if (els.kTeam) els.kTeam.textContent = '0';
      return;
    }

    if (!items.length) {
      els.list.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'row empty';
      empty.textContent = 'No members yet';
      els.list.appendChild(empty);
      if (els.kTeam) els.kTeam.textContent = '0';
      return;
    }

    // Параллельная подкачка метрик
    const stats = await Promise.all(items.map(m => getMemberStats(m.id ?? m.pk)));

    // Сшиваем с фоллбеками значений из списка (если есть)
    const enriched = items.map((m, i) => {
      const st = stats[i] || { unique_users: 0, total_clicks: 0 };
      const clicksFallback  = int(m.total_clicks ?? m.clicks ?? 0);
      const uniquesFallback = int(m.unique_users ?? m.unique_clicks ?? m.uniques ?? 0);
      return {
        ...m,
        unique_users: int(st.unique_users || uniquesFallback),
        total_clicks: int((Number.isFinite(st.total_clicks) ? st.total_clicks : clicksFallback)),
      };
    });

    // Сортировка: клики DESC → уникальные DESC → created_at ASC
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
    sorted.forEach((m, i) => els.list.appendChild(renderRow(i + 1, m)));

    const last = els.list.lastElementChild;
    if (last) last.classList.add('outsider');

    // KPI: общее число участников
    if (els.kTeam) els.kTeam.textContent = formatInt(sorted.length);
  }

  // ---------- создание участника ----------
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
      await loadTeamStats();
    } catch (e) {
      console.error(e);
      toast('Error creating member', 'err');
    } finally {
      creating = false;
      els.btnCreate?.removeAttribute('disabled');
    }
  }

  // ---------- инициализация ----------
  async function init() {
    if (els.roleBadge) els.roleBadge.textContent = 'Status | Editor (can edit)';

    els.btnAdd?.addEventListener('click', () => {
      if (els.memberName) els.memberName.value = '';
      open();
    });

    els.overlay?.addEventListener('click', close);
    $$('[data-close]').forEach(b => b.addEventListener('click', close));
    els.btnCreate?.addEventListener('click', createMemberFlow);

    document.addEventListener('keydown', (ev) => {
      if (!els.modalAdd?.classList.contains('show')) return;
      if (ev.key === 'Enter') { ev.preventDefault(); createMemberFlow(); }
      else if (ev.key === 'Escape') { close(); }
    });

    // Важно: сначала глобальные KPI, затем список (он выставит kTeam)
    await loadTeamStats();
    await loadAndRenderMembers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
