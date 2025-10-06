// assets/js/projects.js
(() => {
  const $  = (s, r=document) => r.querySelector(s);

  // ---- DOM ----
  const els = {
    list: $('#projects-list'),
    openBtn: document.querySelector('[data-open-create-project]'),
    modal: $('#create-project-modal'),
    form: $('#create-project-form'),
    overlay: $('#overlay'),
    roleLabel: $('#roleLabel'),
    roleHint: $('#roleHint'),
  };

  // ---- Utils ----
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
    if (!Number.isFinite(t)) {
      // fallback на строку YYYY-MM-DD -> YYYY.MM.DD
      return safe(iso).replaceAll('-', '.');
    }
    const d = new Date(t);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}.${mm}.${dd}`;
  };

  const openModal  = () => { els.overlay?.classList.add('show'); els.modal?.classList.add('open'); };
  const closeModal = ()  => { els.overlay?.classList.remove('show'); els.modal?.classList.remove('open'); };

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

  // ---- Render ----
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
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'project-row empty';
      empty.textContent = 'No projects yet';
      els.list.appendChild(empty);
      return;
    }

    items.forEach(p => {
      const row = document.createElement('div');
      row.className = 'project-row';
      const from = fmtDate(p.date_from || '');
      const to   = fmtDate(p.date_to || '');
      row.innerHTML = `
        <div class="project-name">${safe(p.name)}</div>
        <div class="project-dates">${from}${to ? ' – ' + to : ''}</div>
        <button class="go-btn" data-id="${p.id}" aria-label="open">→</button>
      `;
      els.list.appendChild(row);
    });
  }

  // Делегирование: клики по кнопкам проектов всегда работают
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.go-btn');
    if (!btn || !els.list?.contains(btn)) return;
    const id = btn.getAttribute('data-id');
    if (id) location.href = `/project/${id}/`;
  });

  // ---- Create Project flow ----
  async function setupCreateProject() {
    const me = await API.me().catch(() => null);
    const isCreator = me?.role === 'creator';

    // статус роли в хэдере
    if (els.roleLabel && els.roleHint) {
      if (isCreator) {
        els.roleLabel.textContent = 'Creator';
        els.roleHint.textContent  = '(can edit)';
      } else {
        els.roleLabel.textContent = 'Viewer';
        els.roleHint.textContent  = '(only view)';
      }
    }

    // дизейбл кнопки для viewer (и убираем фокус/курсор)
    if (!isCreator) {
      els.openBtn?.setAttribute('disabled', 'disabled');
    } else {
      els.openBtn?.removeAttribute('disabled');
    }

    // открыть модалку
    els.openBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isCreator) return toast('YOU CANNOT EDIT', 'error');
      els.form?.reset();
      openModal();
      // автофокус на name
      const nameInput = els.form?.querySelector('input[name="name"]');
      setTimeout(() => nameInput?.focus(), 50);
    });

    // закрытия
    els.overlay?.addEventListener('click', closeModal);
    els.modal?.querySelector('[data-close]')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.modal?.classList.contains('open')) closeModal();
    });

    // Enter внутри модалки — сабмит
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
      if (!isCreator) return toast('YOU CANNOT EDIT', 'error');
      if (submitting) return;
      submitting = true;

      const fd   = new FormData(els.form);
      const name = safe(fd.get('name')).trim();
      const from = safe(fd.get('from')) || null;
      const to   = safe(fd.get('to'))   || null;

      if (!name) { submitting = false; return toast('Enter project name', 'error'); }

      try {
        await API.createProject({ name, date_from: from, date_to: to });
        closeModal();
        toast('SUCCESSFULLY CREATED', 'ok');
        await renderProjects();
      } catch (err) {
        console.error(err);
        toast('Error creating project', 'error');
      } finally {
        submitting = false;
      }
    });
  }

  // ---- Init ----
  (async () => {
    try {
      await renderProjects();
      await setupCreateProject();
    } catch (e) {
      console.error(e);
      toast('Failed to load projects', 'error');
    }
  })();
})();
