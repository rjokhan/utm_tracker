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
    setTimeout(() => { el.classList.remove('show'); el.remove(); }, 2200);
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    try {
      // показываем YYYY.MM.DD (как в макете, точки)
      const [y,m,d] = iso.split('-');
      if (!y || !m || !d) return iso.replaceAll('-', '.');
      return `${y}.${m}.${d}`;
    } catch {
      return iso.replaceAll('-', '.');
    }
  };

  const openModal  = () => { els.overlay.classList.add('show'); els.modal.classList.add('open'); };
  const closeModal = ()  => { els.overlay.classList.remove('show'); els.modal.classList.remove('open'); };

  // ---- Render ----
  async function renderProjects() {
    if (!els.list) return;
    els.list.innerHTML = '';

    const { items = [] } = await API.listProjects();
    items.forEach(p => {
      const row = document.createElement('div');
      row.className = 'project-row';
      const from = fmtDate(p.date_from || '');
      const to   = fmtDate(p.date_to || '');
      row.innerHTML = `
        <div class="project-name">${p.name}</div>
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
    const me = await API.me();
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

    // открыть модалку
    els.openBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isCreator) return toast('YOU CANNOT EDIT', 'error');
      // очистить форму
      if (els.form) {
        els.form.reset();
      }
      openModal();
    });

    // закрытия
    els.overlay?.addEventListener('click', closeModal);
    els.modal?.querySelector('[data-close]')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.modal?.classList.contains('open')) closeModal();
    });

    // отправка формы
    let submitting = false;
    els.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!isCreator) return toast('YOU CANNOT EDIT', 'error');
      if (submitting) return;
      submitting = true;

      const fd   = new FormData(els.form);
      const name = (fd.get('name') || '').toString().trim();
      const from = (fd.get('from') || '').toString() || null;
      const to   = (fd.get('to')   || '').toString() || null;

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
