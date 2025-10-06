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
  };

  // --- state ---
  let creating = false;

  // --- helpers ---
  const open  = () => {
    els.overlay.classList.add('show');
    els.modalAdd.classList.add('show');
    setTimeout(() => els.memberName?.focus(), 50);
  };
  const close = ()  => {
    els.overlay.classList.remove('show');
    els.modalAdd.classList.remove('show');
  };

  const toast = (msg, type='ok') => {
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
      <div class="row skeleton"><div class="idx">#</div><div class="name">Loading…</div><div class="meta">Please wait</div></div>
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
      return;
    }

    sorted.forEach((m, i) => {
      els.list.appendChild(renderRow(i + 1, m));
    });
  }

  // Создание участника
  async function createMemberFlow() {
    const nm = safe(els.memberName?.value).trim();
    if (!nm) { toast('Enter name', 'err'); return;

    }
    if (creating) return;
    creating = true;
    els.btnCreate?.setAttribute('disabled', 'disabled');

    try {
      await API.memberCreate(nm);
      close();
      toast('SUCCESSFULLY CREATED', 'ok');
      await loadAndRenderMembers();
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
    // Роль
    try {
      const me = await API.me();
      if (els.roleBadge) {
        if (me?.role === 'creator') {
          els.roleBadge.textContent = 'Status | Creator (can edit)';
        } else if (me?.role === 'viewer') {
          els.roleBadge.textContent = 'Status | Viewer (only view)';
        } else {
          els.roleBadge.textContent = 'Status | —';
        }
      }

      // Кнопка «Add New Team Member»
      els.btnAdd?.addEventListener('click', () => {
        if (me?.role !== 'creator') {
          toast('YOU CANNOT EDIT', 'err');
          return;
        }
        if (els.memberName) els.memberName.value = '';
        open();
      });

      // Закрытие модалки
      els.overlay?.addEventListener('click', close);
      $$('[data-close]').forEach(b => b.addEventListener('click', close));

      // Submit
      els.btnCreate?.addEventListener('click', () => {
        if (me?.role !== 'creator') {
          toast('YOU CANNOT EDIT', 'err');
          return;
        }
        createMemberFlow();
      });

      // Enter/Escape
      document.addEventListener('keydown', (ev) => {
        if (!els.modalAdd?.classList.contains('show')) return;
        if (ev.key === 'Enter') {
          ev.preventDefault();
          if (me?.role === 'creator') createMemberFlow();
        } else if (ev.key === 'Escape') {
          close();
        }
      });

      // Рендер списка
      await loadAndRenderMembers();
    } catch (e) {
      console.error(e);
      toast('Failed to load members', 'err');
    }
  }

  // go
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
