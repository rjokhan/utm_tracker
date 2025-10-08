// assets/js/index.js
(async () => {
  try {
    // Роль (всегда Editor / can edit)
    const me = (typeof API?.me === 'function') ? await API.me() : {};
    {
      const statusEl = document.querySelector('.status');
      if (statusEl) {
        const role = (me?.role || 'editor').toLowerCase();
        const isEditor = role === 'editor' || role === 'creator';
        statusEl.innerHTML = `Status | <b>${isEditor ? 'Editor' : 'Viewer'}</b> <span class="muted">${isEditor ? '(can edit)' : '(only view)'}</span>`;
      }
    }

    // KPI: проекты / ссылки / клики (общее)
    const s = await API.summary();
    const toInt = v => Number.isFinite(+v) ? (+v).toLocaleString('en-US') : '0';
    [
      ['#kpi-projects', s?.projects],
      ['#kpi-links',    s?.links],
      ['#kpi-clicks',   s?.clicks],
    ].forEach(([sel,val]) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = toInt(val);
    });

    // KPI: уникальные пользователи по всем ссылкам
    try {
      const resp = await fetch('/api/stats/project/');
      const agg = await resp.json();
      const el = document.querySelector('#kpi-uniques');
      if (el) el.textContent = toInt(agg?.unique_users);
    } catch {
      const el = document.querySelector('#kpi-uniques');
      if (el) el.textContent = '0';
    }

    // Лидеры (как раньше)
    const res = await API.globalLeaderboard();
    const leaders = Array.isArray(res?.items) ? res.items : [];

    const podium = document.getElementById('podium');
    const others = document.getElementById('others');

    if (podium) {
      if (leaders.length >= 3) {
        podium.innerHTML = `
          <div class="pod-col">
            <div class="pod-name">${leaders[2].name}</div>
            <div class="pod-step bronze"><div class="pod-place">3</div></div>
            <div class="pod-clicks">${toInt(leaders[2].clicks)} clicks</div>
          </div>
          <div class="pod-col mid">
            <div class="pod-name">${leaders[0].name}</div>
            <div class="pod-step gold"><div class="pod-place">1</div></div>
            <div class="pod-clicks">${toInt(leaders[0].clicks)} clicks</div>
          </div>
          <div class="pod-col">
            <div class="pod-name">${leaders[1].name}</div>
            <div class="pod-step silver"><div class="pod-place">2</div></div>
            <div class="pod-clicks">${toInt(leaders[1].clicks)} clicks</div>
          </div>
        `;
      } else {
        podium.innerHTML = '';
      }
    }

    if (others) {
      others.innerHTML = '';
      leaders.slice(3).forEach((m, idx, arr) => {
        const isLast = idx === arr.length - 1;
        const row = document.createElement('div');
        row.className = 'other' + (isLast ? ' last' : '');
        row.innerHTML = `
          <div class="col name">
            <span class="rank">${idx + 4} –</span>
            <span class="name">${m.name}</span>
          </div>
          <div class="col links">${toInt(m.links)} links</div>
          <div class="col clicks">${toInt(m.clicks)} clicks</div>
        `;
        others.appendChild(row);
      });
    }
  } catch (e) {
    console.error(e);
    // на всякий случай выставим нули
    ['#kpi-projects','#kpi-links','#kpi-clicks','#kpi-uniques'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el && !el.textContent) el.textContent = '0';
    });
  }
})();
