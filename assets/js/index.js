// assets/js/index.js
(async () => {
  try {
    // --- Роль: всегда Editor (can edit) ---
    const me = (typeof API?.me === 'function') ? await API.me() : {};
    const statusEl = document.querySelector('.status');
    if (statusEl) {
      const role = (me?.role || 'editor').toLowerCase();
      const isEditor = role === 'editor' || role === 'creator';
      statusEl.innerHTML = `Status | <b>${isEditor ? 'Editor' : 'Viewer'}</b> <span class="muted">${isEditor ? '(can edit)' : '(only view)'}</span>`;
    }

    // --- KPI ---
    const s = await API.summary();
    const kpis = [
      { sel: '.kpi.kpi-pink .kpi-num',  val: s?.projects },
      { sel: '.kpi.kpi-blue .kpi-num',  val: s?.links },
      { sel: '.kpi.kpi-green .kpi-num', val: s?.clicks },
    ];
    kpis.forEach(k => {
      const el = document.querySelector(k.sel);
      if (el) el.textContent = (k.val ?? 0);
    });

    // --- Лидеры ---
    const res = await API.globalLeaderboard();
    const leaders = Array.isArray(res?.items) ? res.items : [];

    const podium = document.getElementById('podium');
    const others = document.getElementById('others');

    if (podium) {
      if (leaders.length >= 3) {
        // топ-3: в порядке 3-1-2
        podium.innerHTML = `
          <div class="pod-col">
            <div class="pod-name">${leaders[2].name}</div>
            <div class="pod-step bronze"><div class="pod-place">3</div></div>
            <div class="pod-clicks">${leaders[2].clicks} clicks</div>
          </div>
          <div class="pod-col mid">
            <div class="pod-name">${leaders[0].name}</div>
            <div class="pod-step gold"><div class="pod-place">1</div></div>
            <div class="pod-clicks">${leaders[0].clicks} clicks</div>
          </div>
          <div class="pod-col">
            <div class="pod-name">${leaders[1].name}</div>
            <div class="pod-step silver"><div class="pod-place">2</div></div>
            <div class="pod-clicks">${leaders[1].clicks} clicks</div>
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
        const div = document.createElement('div');
        div.className = 'other' + (isLast ? ' last' : '');
        div.innerHTML = `
          <div class="col name">
            <span class="rank">${idx + 4} –</span>
            <span class="name">${m.name}</span>
          </div>
          <div class="col links">${m.links} links</div>
          <div class="col clicks">${m.clicks} clicks</div>
        `;
        others.appendChild(div);
      });
    }
  } catch (e) {
    console.error(e);
  }
})();
