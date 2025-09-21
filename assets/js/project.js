// assets/js/project.js
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---- DOM ----
  const els = {
    name:     $('#projectName'),
    dates:    $('#projectDates'),
    kMembers: $('#kpiMembers'),
    kLinks:   $('#kpiLinks'),
    kClicks:  $('#kpiClicks'),
    podium:   $('#podium'),
    others:   $('#others'),
    corner:   $('#corner'),
    overlay:  $('#overlay'),

    // create link
    modalLink:   $('#modalLink'),
    linkName:    $('#linkName'),
    linkUrl:     $('#linkUrl'),
    linkOwner:   $('#linkOwner'),
    ownerMenu:   $('#ownerMenu'),
    createLinkBtn: $('#createLinkBtn'),
    btnCreateLink: $('#btnCreateLink'),

    // add member
    modalAddMember:  $('#modalAddMember'),
    addMemberInput:  $('#addMemberInput'),
    addMemberMenu:   $('#addMemberMenu'),
    addMemberBtn:    $('#addMemberBtn'),
    btnAddMember:    $('#btnAddMember'),

    // links list
    modalLinksList:  $('#modalLinksList'),
    linksListTitle:  $('#linksListTitle'),
    linksListBody:   $('#linksListBody'),
  };

  // ---- helpers ----
  const toast = (msg, type='ok') => {
    const el = document.createElement('div');
    el.className = `alert ${type} slide`;
    el.textContent = msg;
    els.corner?.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  };

  const openModal  = (m) => { els.overlay.classList.add('show'); m.classList.add('show'); };
  const closeModals = () => {
    els.overlay.classList.remove('show');
    $$('.modal.show').forEach(m => m.classList.remove('show'));
    // закрыть выпадашки
    els.ownerMenu?.classList.remove('show');
    els.addMemberMenu?.classList.remove('show');
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy}`;
    } catch { return iso; }
  };

  const shortUrl = (id) => `${location.origin}/go/${id}`;
  const LINK_ICON = '/static/img/ic-link.png'; // иконка для кнопок ссылок

  // ---- state ----
  const state = {
    me: null,                 // {role}
    projectId: null,          // number
    project: null,            // {id,name,date_from,date_to}
    leaderboard: [],          // [{id,name,links,clicks}]
    membersInProject: [],     // [{id,name,links,clicks}] (из /members)
    allMembersCatalog: [],    // [{id,name}] (из /api/members)
  };

  // ---- get project id from URL /project/<id>/ ----
  function getProjectId() {
    const m = location.pathname.match(/\/project\/(\d+)\//);
    return m ? parseInt(m[1], 10) : null;
  }

  // ---- renderers ----
  function renderHeader() {
    els.name.textContent  = state.project?.name || '';
    const d1 = state.project?.date_from ? fmtDate(state.project.date_from) : '';
    const d2 = state.project?.date_to   ? fmtDate(state.project.date_to)   : '';
    els.dates.textContent = (d1 || d2) ? `${d1}${d2 ? ' – ' + d2 : ''}` : '';
  }

  function renderKPIs() {
    // members count = количество участников в проекте
    const membersCount = state.membersInProject.length;

    // links count + clicks sum можно собрать из членов/лидерборда
    let linksCount = 0, clicksSum = 0;
    state.membersInProject.forEach(m => {
      linksCount += Number(m.links || 0);
      clicksSum  += Number(m.clicks || 0);
    });

    els.kMembers.textContent = membersCount;
    els.kLinks.textContent   = linksCount;
    els.kClicks.textContent  = clicksSum;
  }

  function renderPodiumAndOthers() {
    const podium = els.podium;
    const others = els.others;
    podium.innerHTML = '';
    others.innerHTML = '';

    const list = [...state.leaderboard];
    if (list.length < 1) return;

    // top 3 в порядке 3-1-2
    const order = [2,0,1];
    const top3 = [list[0], list[1], list[2]].filter(Boolean);

    // helper для блока колонки подиума
    const renderPodCol = (member, place) => {
      const cls = place === 1 ? 'gold' : place === 2 ? 'silver' : 'bronze';
      const col = document.createElement('div');
      col.className = 'pod-col' + (place === 1 ? ' mid' : '');
      col.innerHTML = `
        <div class="pod-name">${member.name}</div>
        <div class="pod-bar ${cls}" data-links="${member.id}">
          <button class="link-chip" title="Show links" data-links="${member.id}">
            <img src="${LINK_ICON}" alt="">
          </button>
          <div class="pod-num">${place}</div>
        </div>
        <div class="pod-clicks">${Number(member.clicks||0).toLocaleString('en-US')} clicks</div>
      `;
      podium.appendChild(col);
    };

    // нарисовать подиум
    order.forEach(idx => {
      const m = top3[idx];
      if (!m) return;
      const place = idx === 0 ? 3 : idx === 1 ? 1 : 2; // соответствие индексу
      renderPodCol(m, place);
    });

    // остальные
    const rest = list.slice(3);
    rest.forEach((m, i) => {
      const row = document.createElement('div');
      const isLast = i === rest.length - 1;
      row.className = 'other' + (isLast ? ' last' : '');
      row.innerHTML = `
        <button class="link-chip" title="Show links" data-links="${m.id}">
          <img src="${LINK_ICON}" alt="">
        </button>
        <div class="col name">
          <span class="rank">${i + 4} –</span>
          <span class="name">${m.name}</span>
        </div>
        <div class="col links">${m.links} links</div>
        <div class="col clicks">${Number(m.clicks||0).toLocaleString('en-US')} clicks</div>
      `;
      others.appendChild(row);
    });
  }

  async function openLinksList(ownerId) {
    // подгрузить список ссылок участника
    const { items = [] } = await API.linksByOwner(state.projectId, ownerId);
    const owner = state.membersInProject.find(m => m.id === ownerId);
    els.linksListTitle.textContent = `${owner ? owner.name : 'Member'} — links`;

    els.linksListBody.innerHTML = '';
    if (!items.length) {
      els.linksListBody.innerHTML = `<div class="link-row"><div>No links yet</div><div>0 clicks</div></div>`;
    } else {
      items.forEach(l => {
        const row = document.createElement('div');
        row.className = 'link-row';
        // по клику на имя — копируем короткий редирект /go/<id>
        const short = API.shortLink(l.id);
        row.innerHTML = `
          <div class="link-name" data-url="${short}" title="Click to copy">${l.name}</div>
          <div>${Number(l.clicks||0).toLocaleString('en-US')} clicks</div>
        `;
        els.linksListBody.appendChild(row);
      });
    }
    openModal(els.modalLinksList);
  }

  // ---- events (глобальные) ----
  els.overlay?.addEventListener('click', closeModals);
  $$('[data-close]').forEach(b => b.addEventListener('click', closeModals));

  // клик по кнопке ссылок (на подиуме и в списке)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-links]');
    if (!btn) return;
    try {
      const ownerId = parseInt(btn.dataset.links, 10);
      await openLinksList(ownerId);
    } catch (err) {
      console.error(err);
      toast('Failed to load links', 'err');
    }
  });

  // клик по названию ссылки -> копируем короткий URL
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('.link-name');
    if (!el) return;
    const url = el.dataset.url || '';
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Copied', 'ok');
  });

  // ---- create link flow ----
  els.btnCreateLink?.addEventListener('click', async () => {
    if (state.me?.role !== 'creator') return toast('YOU CANNOT EDIT', 'err');

    // заполнить список владельцев (участников проекта)
    els.ownerMenu.innerHTML = '';
    state.membersInProject.forEach(m => {
      const it = document.createElement('div');
      it.className = 'select-item';
      it.textContent = m.name;
      it.dataset.id = m.id;
      els.ownerMenu.appendChild(it);
    });

    els.linkName.value = '';
    els.linkUrl.value  = '';
    els.linkOwner.value = '';
    delete els.linkOwner.dataset.id;

    openModal(els.modalLink);
  });

  els.linkOwner?.addEventListener('click', () => {
    els.ownerMenu.classList.toggle('show');
  });

  els.ownerMenu?.addEventListener('click', (e) => {
    const it = e.target.closest('.select-item');
    if (!it) return;
    els.linkOwner.value = it.textContent;
    els.linkOwner.dataset.id = it.dataset.id;
    els.ownerMenu.classList.remove('show');
  });

  els.createLinkBtn?.addEventListener('click', async () => {
    if (state.me?.role !== 'creator') return toast('YOU CANNOT EDIT', 'err');

    const name = (els.linkName.value || '').trim();
    const url  = (els.linkUrl.value  || '').trim();
    const owner_id = parseInt(els.linkOwner.dataset.id || '0', 10);
    if (!name || !url || !owner_id) return toast('Fill all fields', 'err');

    try {
      const { id } = await API.linkCreate(state.projectId, { owner_id, name, target_url: url });
      closeModals();
      toast('SUCCESSFULLY CREATED', 'ok');
      // Обновим лидерборд и KPI (новая ссылка = 0 кликов, но count должен вырасти)
      await reloadMembersAndLeaderboard();
      renderKPIs();
      renderPodiumAndOthers();

      // Показать короткую ссылку
      const short = API.shortLink(id);
      try { await navigator.clipboard.writeText(short); toast('Short URL copied', 'ok'); }
      catch { toast(short, 'ok'); }
    } catch (err) {
      console.error(err);
      toast('Error creating link', 'err');
    }
  });

  // ---- add member to project ----
  els.btnAddMember?.addEventListener('click', async () => {
    if (state.me?.role !== 'creator') return toast('YOU CANNOT EDIT', 'err');

    // загрузим актуальный глобальный список (если пуст)
    if (!state.allMembersCatalog.length) {
      const { items = [] } = await API.membersAll();
      state.allMembersCatalog = items;
    }

    // исключим уже добавленных
    const already = new Set(state.membersInProject.map(m => m.id));
    els.addMemberMenu.innerHTML = '';
    state.allMembersCatalog.filter(m => !already.has(m.id)).forEach(m => {
      const it = document.createElement('div');
      it.className = 'select-item';
      it.textContent = m.name;
      it.dataset.id = m.id;
      els.addMemberMenu.appendChild(it);
    });

    els.addMemberInput.value = '';
    delete els.addMemberInput.dataset.id;

    openModal(els.modalAddMember);
  });

  els.addMemberInput?.addEventListener('click', () => {
    els.addMemberMenu.classList.toggle('show');
  });

  els.addMemberMenu?.addEventListener('click', (e) => {
    const it = e.target.closest('.select-item');
    if (!it) return;
    els.addMemberInput.value = it.textContent;
    els.addMemberInput.dataset.id = it.dataset.id;
    els.addMemberMenu.classList.remove('show');
  });

  els.addMemberBtn?.addEventListener('click', async () => {
    if (state.me?.role !== 'creator') return toast('YOU CANNOT EDIT', 'err');
    const member_id = parseInt(els.addMemberInput.dataset.id || '0', 10);
    if (!member_id) return toast('Choose member', 'err');

    try {
      await API.projectAddMember(state.projectId, member_id);
      closeModals();
      toast('SUCCESSFULLY CREATED', 'ok');
      await reloadMembersAndLeaderboard();
      renderKPIs();
      renderPodiumAndOthers();
    } catch (err) {
      console.error(err);
      toast('Error adding member', 'err');
    }
  });

  // ---- data loaders ----
  async function loadMe() {
    state.me = await API.me(); // {role}
  }

  async function loadProject() {
    state.project = await API.projectDetail(state.projectId);
  }

  async function loadMembersInProject() {
    // items: [{id,name,links,clicks}]
    const { items = [] } = await API.projectMembers(state.projectId);
    state.membersInProject = items;
  }

  async function loadLeaderboard() {
    // items: [{id,name,links,clicks}]
    const { items = [] } = await API.projectLeaderboard(state.projectId);
    state.leaderboard = items;
  }

  async function reloadMembersAndLeaderboard() {
    await Promise.all([loadMembersInProject(), loadLeaderboard()]);
  }

  async function init() {
    state.projectId = getProjectId();
    if (!state.projectId) {
      console.error('projectId not found in URL');
      return;
    }

    try {
      await loadMe();
      await Promise.all([loadProject(), reloadMembersAndLeaderboard()]);
      renderHeader();
      renderKPIs();
      renderPodiumAndOthers();
    } catch (err) {
      console.error(err);
      toast('Failed to load project', 'err');
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
