/* static/js/api.js
 * Единая точка запросов к бэку.
 * AUTH отключен (все — редакторы).
 */
window.API = (() => {
  // ---------- helpers ----------
  const toJSON = async (res) => {
    if (!res.ok) {
      let payload = null;
      try { payload = await res.json(); } catch (_) {}
      const detail = payload?.detail || payload?.message || '';
      const msg = `API ${res.status} ${res.statusText}${detail ? ' - ' + detail : ''}`;
      throw new Error(msg);
    }
    try { return await res.json(); } catch (_) { return {}; }
  };

  const withDefaults = (init = {}) => ({
    credentials: 'same-origin',
    redirect: 'follow',
    ...init,
    headers: {
      ...(init.headers || {}),
    },
  });

  const GET = (url) => fetch(url, withDefaults()).then(toJSON);

  // --- CSRF ---
  const getCookie = (name) => {
    const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m.pop()) : '';
  };
  const csrftoken = () => getCookie('csrftoken');

  const POST = (url, body = {}) => fetch(url, withDefaults({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrftoken(),
    },
    body: JSON.stringify(body),
  })).then(toJSON);

  // ---------- Auth stubs ----------
  const login  = async (_username) => ({ ok: true, username: 'Editor', role: 'editor', is_editor: true });
  const logout = async () => ({ ok: true });
  const me     = async () => ({ auth: true, username: 'Editor', role: 'editor', is_editor: true });

  // ---------- Dashboard ----------
  const summary           = () => GET('/api/summary');
  const globalLeaderboard = () => GET('/api/leaderboard/global');

  // ---------- Projects ----------
  const listProjects = async () => {
    const res = await GET('/api/projects');
    // совместимость: массив, {items:[]}, {results:[]}
    if (Array.isArray(res)) return { items: res };
    if (res?.items) return res;
    if (res?.results) return { items: res.results };
    return { items: [] };
  };

  // создаём с «совместимостью» по бэкенду (create vs /, разные ключи дат)
  const createProject = async (data) => {
    const payload = {
      name: data.name,
      date_from: data.date_from ?? data.from ?? null,
      date_to:   data.date_to   ?? data.to   ?? null,
    };
    // на всякий — альтернативные ключи, если на бэке так ожидается
    const alt = {
      start_date: payload.date_from ?? null,
      end_date:   payload.date_to   ?? null,
      from:       payload.date_from ?? null,
      to:         payload.date_to   ?? null,
    };
    // пробуем основной маршрут
    try {
      return await POST('/api/projects/create', payload);
    } catch (e) {
      // если роута нет/метод не разрешён/редиректится — пробуем POST /api/projects/
      if (/API (404|405|301|302)/.test(e.message)) {
        try { return await POST('/api/projects/', { ...payload, ...alt }); }
        catch (e2) { throw e2; }
      }
      throw e;
    }
  };

  const projectDetail      = (id) => GET(`/api/projects/${id}`);
  const projectLeaderboard = (id) => GET(`/api/projects/${id}/leaderboard`);
  const projectMembers     = (id) => GET(`/api/projects/${id}/members`);
  const projectAddMember   = (id, member_id) => POST(`/api/projects/${id}/members/add`, { member_id });

  // ---------- Members ----------
  const membersAll   = async () => {
    const res = await GET('/api/members');
    if (Array.isArray(res)) return { items: res };
    if (res?.items) return res;
    if (res?.results) return { items: res.results };
    return { items: [] };
  };
  const memberCreate = (name) => POST('/api/members/create', { name });

  // ---------- Links ----------
  const linkCreate = (projectId, { owner_id, name, target_url }) =>
    POST(`/api/projects/${projectId}/links/create`, { owner_id, name, target_url });

  const linksByOwner = async (projectId, ownerId) => {
    const res = await GET(`/api/projects/${projectId}/links/by-owner/${ownerId}`);
    if (Array.isArray(res)) return { items: res };
    if (res?.items) return res;
    if (res?.results) return { items: res.results };
    return { items: [] };
  };

  const shortLink = (linkId) => `${location.origin}/go/${linkId}`;

  return {
    // auth
    login, logout, me,
    // dashboard
    summary, globalLeaderboard,
    // projects
    listProjects, createProject, projectDetail,
    projectLeaderboard, projectMembers, projectAddMember,
    // members
    membersAll, memberCreate,
    // links
    linkCreate, linksByOwner, shortLink,
  };
})();


(function () {
  try {
    let key = localStorage.getItem('qp_user_key');
    if (!key) {
      // надёжный постоянный идентификатор устройства
      key = (crypto && crypto.randomUUID) ? crypto.randomUUID() :
            Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('qp_user_key', key);
    }
    window.QP_USER_KEY = key; // используйте везде, где вызываете /api/track-click
  } catch (e) {
    // совсем крайний случай
    window.QP_USER_KEY = 'fallback-' + Date.now();
  }
})();
