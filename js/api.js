const API = (() => {
  const backendUrl = 'http://localhost:8000';

  function token() {
    return localStorage.getItem('auth_token') || '';
  }

  function headers(json = true) {
    const result = {};
    if (json) result['Content-Type'] = 'application/json';
    const authToken = token();
    if (authToken) result.Authorization = `Bearer ${authToken}`;
    return result;
  }

  async function request(path, options = {}) {
    const { skipAuthRedirect = false, json = options.body !== undefined, ...fetchOptions } = options;
    const response = await fetch(`${backendUrl}${path}`, {
      ...fetchOptions,
      headers: {
        ...headers(json),
        ...(fetchOptions.headers || {}),
      },
    });

    if (response.status === 401 && !skipAuthRedirect) {
      logout();
      location.replace('./login.html');
      throw new Error('登录已过期，请重新登录');
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data.detail || `请求失败：HTTP ${response.status}`);
    }
    return data;
  }

  function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('username');
  }

  function ensureRole(allowedRoles) {
    const authToken = token();
    const role = localStorage.getItem('user_role');
    if (!authToken || !allowedRoles.includes(role)) {
      logout();
      location.replace('./login.html');
      return false;
    }
    return true;
  }

  function filename(source) {
    if (!source) return '';
    const normalized = source.replaceAll('\\', '/');
    return normalized.split('/').pop() || source;
  }

  return {
    backendUrl,
    request,
    logout,
    ensureRole,
    filename,
    login: (username, password) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        skipAuthRedirect: true,
      }),
    uploadDocument: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return request('/documents/upload', {
        method: 'POST',
        body: formData,
        json: false,
      });
    },
    inputKnowledge: (title, content) =>
      request('/knowledge/input', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      }),
    listDocuments: () => request('/documents', { method: 'GET' }),
    listVerifiedDocuments: () => request('/documents/verified', { method: 'GET' }),
    pendingDocuments: () => request('/pending', { method: 'GET' }),
    approveDocument: (docId) => request(`/approve/${encodeURIComponent(docId)}`, { method: 'POST' }),
    rejectDocument: (docId) => request(`/reject/${encodeURIComponent(docId)}`, { method: 'POST' }),
    previewDocument: (docId) => request(`/documents/${encodeURIComponent(docId)}/preview`, { method: 'GET' }),
    deleteDocument: (source) => request(`/documents/${encodeURIComponent(source)}`, { method: 'DELETE' }),
    debugRetrieve: (query, topK = 5, includePending = false) =>
      request('/debug/retrieve', {
        method: 'POST',
        body: JSON.stringify({ query, top_k: topK, include_pending: includePending }),
      }),
    health: () => request('/health', { method: 'GET' }),
  };
})();



