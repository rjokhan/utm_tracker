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

  // --- helpers ---
  const open  = () => { els.overlay.classList.add('show'); els.modalAdd.classList.add('show'); };
  const close = ()  => { els.overlay.classList.remove('show'); els.modalAdd.classList.remove('show'); };

  const toast = (msg, type='ok') => {
    const el = document.createElement('div');
    el.className = `alert ${type} slide`;
    el.textContent = msg;
    els.corner.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  };

  const formatInt = (n) => {
    const v = Number(n || 0);
    return v.toLocaleString('en-US'); // макет без пробелов, как на рефе
  };

  // Рендер строки участника
  function renderRow(idx, item) {
    const row = document.createElement('div');
    row.className = 'row';
    const name = (item.name || '').toString();
    // ожидаем от API (желательно): active_projects, clicks, created_at
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

  // Загрузка и рендер списка
  async function loadAndRenderMembers() {
    els.list.innerHTML = '';
    const { items = [] } = await API.membersAll();

    // Порядок «старые → новые». Если сервер уже отдаёт, ничего не меняем.
    // Если есть created_at — сортируем по нему, иначе оставляем как есть.
    const sorted = [...items].sort((a, b) => {
      const ca = new Date(a.created_at || 0).getTime();
      const cb = new Date(b.created_at || 0).getTime();
      return ca - cb;
    });

    sorted.forEach((m, i) => {
      els.list.appendChild(renderRow(i + 1, m));
    });
  }

  // Создание участника
  async function createMemberFlow() {
    const nm = (els.memberName.value || '').trim();
    if (!nm) { toast('Enter name', 'err'); return; }
    await API.memberCreate(nm);
    close();
    toast('SUCCESSFULLY CREATED', 'ok');
    await loadAndRenderMembers();
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
        els.memberName.value = '';
        open();
      });

      // Модалка
      els.overlay?.addEventListener('click', close);
      $$('[data-close]').forEach(b => b.addEventListener('click', close));
      els.btnCreate?.addEventListener('click', async () => {
        if (me?.role !== 'creator') {
          toast('YOU CANNOT EDIT', 'err');
          return;
        }
        try {
          await createMemberFlow();
        } catch (e) {
          console.error(e);
          toast('Error creating member', 'err');
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
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
