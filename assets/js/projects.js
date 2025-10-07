// static/js/projects.js
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const els = {
    list: $('#projects-list'),
    openBtn: document.querySelector('[data-open-create-project], #btnCreateProject'),
    modal: $('#create-project-modal'),
    form: $('#create-project-form'),
    overlay: $('#overlay'),
  };

  // ---------- Toast ----------
  const toast = (msg, type='error') => {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); el.remove(); }, 2400);
  };

  const safe = (v) => (v ?? '').toString();
  const fmtDate = (iso) => {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return safe(iso).replaceAll('-', '.');
    const d = new Date(t);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth()+1).padStart(2,'0');
    const dd   = String(d.getDate()).padStart(2,'0');
    return `${yyyy}.${mm}.${dd}`;
  };

  // ---------- Modal ----------
  const openModal  = () => {
    els.overlay?.classList.add('open');
    els.modal?.classList.add('open');
    document.body.classList.add('modal-open');
    const nameInput = els.form?.querySelector('input[name="name"]');
    setTimeout(() => nameInput?.focus(), 50);
  };
  const closeModal = ()  => {
    els.overlay?.classList.remove('open');
    els.modal?.classList.remove('open');
    document.body.classList.remove('modal-open');
  };
  els.modal?.addEventListener('click', (e) => e.stopPropagation()); // клики внутри модалки не закрывают её

  // ---------- Skeleton ----------
  const renderSkeleton = () => {
    if (!els.list) return;
    els.list.innerHTML = '';
    for (let i=0;i<3;i++){
      const row = document.createElement('div');
      row.className = 'project-row skeleton';
      row.innerHTML = `
        <div class="project-name">Loading…</div>
        <div class="project-dates">YYYY.MM.DD – YYYY.MM.DD</div>
        <button class="go-btn" aria-label="open" disabled>→</button>
      `;
      els.list.appendChild(row);
    }
  };

  // ---------- Render ----------
  async function renderProjects() {
    if (!els.list) return;
    renderSkeleton();

    let items = [];
    try {
      const res = await API.listProjects();
      items = res?.items || [];
    } catch (e) {
      console.error(e);
      els.list.innerHTML = '';
      toast('Failed to load projects', 'error');
      return;
    }

    els.list.innerHTML = '';
    if (!Array.isArray(items) || !items.length) {
      const empty = document.createElement('div');
      empty.className = 'project-row empty';
      empty.textContent = 'No projects yet';
      els.list.appendChild(empty);
      return;
    }

    items.forEach(p => {
      const row = document.createElement('div');
      row.className = 'project-row';
      const from = fmtDate(p.date_from || p.start_date || p.from || '');
      const to   = fmtDate(p.date_to   || p.end_date   || p.to   || '');
      row.innerHTML = `
        <div class="project-name">${safe(p.name)}</div>
        <div class="project-dates">${from}${to ? ' – ' + to : ''}</div>
        <button class="go-btn" data-id="${p.id}" aria-label="open">→</button>
      `;
      els.list.appendChild(row);
    });
  }

  // Переход в проект
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.go-btn');
    if (!btn || !els.list?.contains(btn)) return;
    const id = btn.getAttribute('data-id');
    if (id) location.href = `/project/${id}/`;
  });

  // ---------- Create Project flow ----------
  async function setupCreateProject() {
    // открыть модалку
    els.openBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      els.form?.reset();
      openModal();
    });

    // закрытия
    els.overlay?.addEventListener('click', closeModal);
    els.modal?.querySelector('[data-close]')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.modal?.classList.contains('open')) closeModal();
    });

    // Enter в инпутах — сабмит
    els.modal?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        els.form?.requestSubmit?.();
      }
    });

    // отправка формы
    let submitting = false;
    els.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      submitting = true;

      const fd   = new FormData(els.form);
      const name = safe(fd.get('name')).trim();
      const from = safe(fd.get('from')) || null;
      const to   = safe(fd.get('to'))   || null;

      if (!name) { submitting = false; return toast('Enter project name', 'error'); }

      try {
        const created = await API.createProject({ name, date_from: from, date_to: to });
        closeModal();
        toast(`SUCCESSFULLY CREATED`, 'ok');

        // Если API вернул id — можно сразу перейти в проект
        if (created?.id) {
          // сразу обновим список и подсветим
          await renderProjects();
          // необязательный автопереход:
          // location.href = `/project/${created.id}/`;
          return;
        }

        // если id не пришёл — просто перерисуем список
        await renderProjects();
      } catch (err) {
        console.error(err);
        toast(err.message || 'Error creating project', 'error');
      } finally {
        submitting = false;
      }
    });
  }

  // ---------- Init ----------
  (async () => {
    try {
      await renderProjects();
      await setupCreateProject();
    } catch (e) {
      console.error(e);
      toast('Init error', 'error');
    }
  })();
})();
