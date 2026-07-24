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
    login: (username, password, role) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
        skipAuthRedirect: true,
      }),
    requestRegistration: (payload) => request('/auth/register/request', {
      method: 'POST', body: JSON.stringify(payload), skipAuthRedirect: true,
    }),
    sendVerificationCode: (email, purpose) => request('/auth/send-verification-code', {
      method: 'POST', body: JSON.stringify({ email, purpose }), skipAuthRedirect: true,
    }),
    reviewerRegistrationRequests: () => request('/reviewer/registration-requests', { method: 'GET' }),
    reviewEmployeeRegistration: (id, action) => request(`/reviewer/registration-requests/${id}/${action}`, { method: 'POST' }),
    developerRegistrationRequests: () => request('/developer/registration-requests', { method: 'GET' }),
    reviewDeveloperRegistration: (id, action) => request(`/developer/registration-requests/${id}/${action}`, { method: 'POST' }),
    developerUsers: () => request('/developer/users', { method: 'GET' }),
    developerEnterprisePassword: () => request('/developer/enterprise-password', { method: 'GET' }),
    developerHeadcountStats: () => request('/developer/headcount-stats', { method: 'GET' }),
    developerPersonnelDetail: () => request('/developer/personnel-detail', { method: 'GET' }),
    setPersonnelFlag: (id, flagged) => request(`/developer/users/${encodeURIComponent(id)}/flag`, { method: 'PATCH', body: JSON.stringify({ flagged }) }),
    savePersonnelNotes: (id, notes) => request(`/developer/users/${encodeURIComponent(id)}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
    developerPasswordResetEvents: () => request('/developer/password-reset-events', { method: 'GET' }),
    reviewerPasswordResetEvents: () => request('/reviewer/password-reset-events', { method: 'GET' }),
    reviewerEnterprisePassword: () => request('/reviewer/enterprise-password', { method: 'GET' }),
    forgotPassword: (username, enterprisePassword, verificationCode) => request('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ username, enterprise_password: enterprisePassword, verification_code: verificationCode }), skipAuthRedirect: true,
    }),
    setUserActive: (id, active) => request(`/developer/users/${encodeURIComponent(id)}/${active ? 'enable' : 'disable'}`, { method: 'POST' }),
    changeUserRole: (id, targetRole) => request(`/developer/users/${encodeURIComponent(id)}/change_role`, { method: 'POST', body: JSON.stringify({ target_role: targetRole }) }),
    resetUserPassword: (id) => request(`/developer/users/${encodeURIComponent(id)}/reset_password`, { method: 'POST' }),
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
    reviewerMetrics: () => request('/reviewer/metrics', { method: 'GET' }),
    systemModules: () => request('/developer/system-modules', { method: 'GET' }),
    saveSystemModules: (modules) => request('/developer/system-modules', {
      method: 'PUT',
      body: JSON.stringify(modules),
    }),
  };
})();



