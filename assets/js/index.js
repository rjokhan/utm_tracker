// assets/js/index.js
(async () => {
  const qs = (sel) => document.querySelector(sel);
  const setNum = (sel, v) => { const el = qs(sel); if (el) el.textContent = v; };
  const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
  };

  try {
    // Status (Editor / Viewer)
    const me = (typeof API?.me === 'function') ? await API.me() : {};
    const statusEl = qs('.status');
    if (statusEl) {
      const role = (me?.role || 'editor').toLowerCase();
      const isEditor = role === 'editor' || role === 'creator';
      statusEl.innerHTML =
        `Status | <b>${isEditor ? 'Editor' : 'Viewer'}</b> <span class="muted">${isEditor ? '(can edit)' : '(only view)'}</span>`;
    }

    // KPI: projects / links / clicks
    const s = await API.summary();
    setNum('#kpi-projects', toInt(s?.projects));
    setNum('#kpi-links',    toInt(s?.links));
    setNum('#kpi-clicks',   toInt(s?.clicks));

    // KPI: unique users (all links) — correct endpoint
    try {
      const resp = await fetch('/api/project-stats/', { credentials: 'same-origin' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const agg = await resp.json();
      setNum('#kpi-uniques', toInt(agg?.unique_users));
    } catch {
      setNum('#kpi-uniques', '0');
    }

    // Global leaderboard
    const res = await API.globalLeaderboard();
    const leaders = Array.isArray(res?.items) ? res.items : [];

    const podium = qs('#podium');
    const others = qs('#others');

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
    ['#kpi-projects', '#kpi-links', '#kpi-clicks', '#kpi-uniques'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el && !el.textContent) el.textContent = '0';
    });
  }
})();


