/* assets/js/api.js
 * Единственная точка входа для запросов к бэку.
 * Все пути соответствуют /api/... как настроено в urls.py
 */
window.API = (() => {
  // --- утилиты --------------------------------------------------------------
  const toJSON = async (res) => {
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).detail || ''; } catch (_) {}
      throw new Error(`API ${res.status} ${res.statusText} ${detail}`.trim());
    }
    return res.json();
  };

  const withDefaults = (init = {}) => ({
    credentials: 'same-origin',
    redirect: 'follow',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const GET  = (url)            => fetch(url, withDefaults()).then(toJSON);
  const POST = (url, body = {}) => fetch(url, withDefaults({
    method: 'POST',
    body: JSON.stringify(body),
  })).then(toJSON);

  // Если включишь CSRF (и уберёшь @csrf_exempt), раскомментируй блок ниже:
  /*
  const getCookie = (name) => {
    const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  };
  const POST = (url, body = {}) => fetch(url, withDefaults({
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'X-CSRFToken': getCookie('csrftoken') }
  })).then(toJSON);
  */

  // --- Auth / Role ----------------------------------------------------------
  // username login → session (создаёт Member при необходимости)
  const login  = (username) => POST('/api/login', { username }); // -> {ok, username, role, is_editor}
  const logout = () => POST('/api/logout', {});                  // -> {ok: true}
  const me     = () => GET('/api/me');                           // -> {auth, username?, role, is_editor?}

  // --- Dashboard ------------------------------------------------------------
  const summary           = () => GET('/api/summary');            // -> {projects,links,clicks}
  const globalLeaderboard = () => GET('/api/leaderboard/global'); // -> {items:[{id,name,links,clicks}]}

  // --- Projects -------------------------------------------------------------
  const listProjects       = () => GET('/api/projects');                     // -> {items:[{id,name,date_from,date_to}]}
  const createProject      = (data) => POST('/api/projects/create', data);   // -> {id}
  const projectDetail      = (id) => GET(`/api/projects/${id}`);             // -> {id,name,date_from,date_to}
  const projectLeaderboard = (id) => GET(`/api/projects/${id}/leaderboard`); // -> {items:[{id,name,links,clicks}]}
  const projectMembers     = (id) => GET(`/api/projects/${id}/members`);     // -> {items:[{id,name,links,clicks}]}
  const projectAddMember   = (id, member_id) =>
    POST(`/api/projects/${id}/members/add`, { member_id });                  // -> {ok:true}

  // --- Members (глобальный справочник) -------------------------------------
  const membersAll   = () => GET('/api/members');                   // -> {items:[{id,name,is_editor,active_projects,links,clicks,created_at}]}
  const memberCreate = (name) => POST('/api/members/create', { name }); // -> {id, created:true|false}

  // --- Links ----------------------------------------------------------------
  const linkCreate = (projectId, { owner_id, name, target_url }) =>
    POST(`/api/projects/${projectId}/links/create`, { owner_id, name, target_url }); // -> {id}

  const linksByOwner = (projectId, ownerId) =>
    GET(`/api/projects/${projectId}/links/by-owner/${ownerId}`); // -> {items:[{id,name,clicks,target_url}]}

  // Сервис: короткая ссылка для шеринга (увеличит клики при переходе)
  const shortLink = (linkId) => `${location.origin}/go/${linkId}`;

  // Публичный API
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
