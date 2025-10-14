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

  const open  = () => { els.overlay?.classList.add('show'); els.modalAdd?.classList.add('show'); setTimeout(() => els.memberName?.focus(), 50); };
  const close = ()  => { els.overlay?.classList.remove('show'); els.modalAdd?.classList.remove('show'); };

  // ---------- low-level fetchers ----------
  async function fetchJson(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function fetchLinkUnique(linkId) {
    try {
      const d = await fetchJson(`/api/link-stats/${linkId}/`);
      return int(d?.unique_users ?? d?.unique ?? 0);
    } catch { return 0; }
  }

  async function fetchLinksByOwnerAny(ownerId) {
    // 1) api.js helper, если у вас есть агрегатор по всем проектам
    try {
      if (window.API?.linksByOwnerAll) {
        const r = await API.linksByOwnerAll(ownerId);
        return r?.items || [];
      }
    } catch {}

    // 2) REST-варианты без projectId
    const tryUrls = [
      `/api/links-by-owner/${ownerId}/`,
      `/api/owner/${ownerId}/links/`,
      `/api/links/?owner=${ownerId}`,
    ];
    for (const u of tryUrls) {
      try {
        const d = await fetchJson(u);
        // поддерживаем {items:[]} и []
        const items = Array.isArray(d) ? d : (d?.items || []);
        if (items.length) return items;
      } catch {}
    }
    return [];
  }

  async function fetchAllProjects() {
    try {
      const d = await fetchJson('/api/projects/');
      return Array.isArray(d) ? d : (d?.items || []);
    } catch { return []; }
  }

  // ---------- member stats with strong fallbacks ----------
  /**
   * Возвращает суммарные метрики участника по ВСЕМ проектам:
   * { unique_users, total_clicks }
   */
  async function getMemberStats(memberId) {
    // 0) основной «готовый» эндпоинт, если поддерживает «scope=all»
    try {
      const d = await fetchJson(`/api/member-stats/${memberId}/?scope=all`);
      const uniques = int(d?.unique_clicks ?? d?.unique_users ?? d?.uniques ?? d?.unique ?? 0);
      const total   = int(d?.total_clicks ?? d?.clicks ?? 0);
      if (uniques || total) return { unique_users: uniques, total_clicks: total };
    } catch {}

    // 1) пробуем собрать все ссылки участника без привязки к проекту
    try {
      const links = await fetchLinksByOwnerAny(memberId);
      if (links.length) {
        const total = links.reduce((s, l) => s + int(l?.clicks ?? 0), 0);
        const uniquesArr = await Promise.all(links.map(l => fetchLinkUnique(l.id)));
        const uniques = uniquesArr.reduce((s, u) => s + int(u), 0);
        return { unique_users: uniques, total_clicks: total };
      }
    } catch {}

    // 2) жёсткий фоллбек: обойти проекты и собрать через API.linksByOwner(project_id, owner_id)
    try {
      const projects = await fetchAllProjects();
      let total = 0, uniques = 0;
      for (const p of projects) {
        const pid = p?.id ?? p?.pk;
        if (!pid) continue;
        try {
          if (window.API?.linksByOwner) {
            const r = await API.linksByOwner(pid, memberId);
            const items = r?.items || [];
            total += items.reduce((s, l) => s + int(l?.clicks ?? 0), 0);
            const uniqArr = await Promise.all(items.map(l => fetchLinkUnique(l.id)));
            uniques += uniqArr.reduce((s, u) => s + int(u), 0);
          }
        } catch {}
      }
      return { unique_users: uniques, total_clicks: total };
    } catch {}

    return { unique_users: 0, total_clicks: 0 };
  }

  // ---------- global KPIs ----------
  async function loadTeamStats() {
    try {
      const data = await fetchJson('/api/project-stats/');
      if (els.kClicks)  els.kClicks.textContent  = formatInt(data.total_clicks ?? 0);
      if (els.kUniques) els.kUniques.textContent = formatInt(data.unique_users ?? data.unique_clicks ?? 0);
      // kTeam здесь НЕ трогаем
    } catch {
      if (els.kClicks)  els.kClicks.textContent  = '—';
      if (els.kUniques) els.kUniques.textContent = '—';
    }
  }

  // ---------- row render ----------
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

  // ---------- load & render members ----------
  async function loadAndRenderMembers() {
    if (!els.list) return;
    renderLoading();

    let items = [];
    try {
      const res = await (window.API?.membersAll ? API.membersAll() : fetchJson('/api/members/'));
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

    // Параллельно подкачиваем метрики
    const stats = await Promise.all(items.map(m => getMemberStats(m.id ?? m.pk)));

    // Сшиваем с фоллбеками значений из списка (если есть)
    const enriched = items.map((m, i) => {
      const st = stats[i] || { unique_users: 0, total_clicks: 0 };
      const clicksFallback  = int(m.total_clicks ?? m.clicks ?? 0);
      const uniquesFallback = int(m.unique_users ?? m.unique_clicks ?? m.uniques ?? 0);
      return {
        ...m,
        unique_users: int(st.unique_users || uniquesFallback),
        total_clicks: int(Number.isFinite(st.total_clicks) ? st.total_clicks : clicksFallback),
      };
    });

    // Сортировка: клики DESC → уникальные DESC → дата ASC
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

    if (els.kTeam) els.kTeam.textContent = formatInt(sorted.length);
  }

  // ---------- create member ----------
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

  // ---------- init ----------
  async function init() {
    if (els.roleBadge) els.roleBadge.textContent = 'Status | Editor (can edit)';

    els.btnAdd?.addEventListener('click', () => { if (els.memberName) els.memberName.value = ''; open(); });
    els.overlay?.addEventListener('click', close);
    $$('[data-close]').forEach(b => b.addEventListener('click', close));
    els.btnCreate?.addEventListener('click', createMemberFlow);

    document.addEventListener('keydown', (ev) => {
      if (!els.modalAdd?.classList.contains('show')) return;
      if (ev.key === 'Enter') { ev.preventDefault(); createMemberFlow(); }
      else if (ev.key === 'Escape') { close(); }
    });

    await loadTeamStats();       // глобальные KPI
    await loadAndRenderMembers();// список + kTeam
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
