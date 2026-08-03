const API = (() => {
  const configuredUrl = window.ZHITIAN_CONFIG?.apiBaseUrl;
  const backendUrl = (
    typeof configuredUrl === 'string' && configuredUrl.trim()
      ? configuredUrl.trim()
      : '/api'
  ).replace(/\/+$/, '');

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
      // 仅失效当前激活账号，saved_accounts 中的其他账号保持可用
      const active = getActiveAccount();
      if (active) removeSavedAccount(active.username, active.role);
      logout();
      sessionStorage.setItem('auth_notice', '该账号登录已过期，请重新登录');
      location.replace('./login.html');
      throw new Error('该账号登录已过期，请重新登录');
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

  // 多身份切换：saved_accounts 保存已登录过的账号，auth_token/user_role/username
  // 三个原有字段继续表示"当前激活账号"，保持既有读取逻辑向后兼容。
  const SAVED_ACCOUNTS_KEY = 'saved_accounts';

  function getSavedAccounts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && item.username && item.role && item.token);
    } catch (error) {
      return [];
    }
  }

  function saveAccounts(accounts) {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function addOrUpdateSavedAccount(username, role, authToken) {
    const accounts = getSavedAccounts();
    const existing = accounts.find((item) => item.username === username && item.role === role);
    if (existing) {
      existing.token = authToken;
      existing.savedAt = new Date().toISOString();
    } else {
      accounts.push({ username, role, token: authToken, savedAt: new Date().toISOString() });
    }
    saveAccounts(accounts);
    return accounts;
  }

  function setActiveAccount(username, role) {
    const target = getSavedAccounts().find(
      (item) => item.username === username && item.role === role,
    );
    if (!target) return false;
    localStorage.setItem('auth_token', target.token);
    localStorage.setItem('user_role', target.role);
    localStorage.setItem('username', target.username);
    return true;
  }

  function removeSavedAccount(username, role) {
    const remaining = getSavedAccounts().filter(
      (item) => !(item.username === username && item.role === role),
    );
    saveAccounts(remaining);
    return remaining;
  }

  function getActiveAccount() {
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('user_role');
    if (!username || !role) return null;
    return { username, role };
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
    getSavedAccounts,
    addOrUpdateSavedAccount,
    setActiveAccount,
    removeSavedAccount,
    getActiveAccount,
    login: (username, password, role) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
        skipAuthRedirect: true,
      }),
    requestRegistration: (payload) => request('/auth/register/request', {
      method: 'POST', body: JSON.stringify(payload), skipAuthRedirect: true,
    }),
    sendVerificationCode: (email, purpose, enterprisePassword) => request('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose, enterprise_password: enterprisePassword }),
      skipAuthRedirect: true,
    }),
    reviewerRegistrationRequests: () => request('/reviewer/registration-requests', { method: 'GET' }),
    reviewEmployeeRegistration: (id, action) => request(`/reviewer/registration-requests/${id}/${action}`, { method: 'POST' }),
    developerRegistrationRequests: () => request('/developer/registration-requests', { method: 'GET' }),
    reviewDeveloperRegistration: (id, action) => request(`/developer/registration-requests/${id}/${action}`, { method: 'POST' }),
    developerUsers: () => request('/developer/users', { method: 'GET' }),
    developerEnterprisePassword: () => request('/developer/enterprise-password', { method: 'GET' }),
    refreshEnterprisePassword: () => request('/developer/enterprise-password/refresh', { method: 'POST' }),
    developerEmailUsage: () => request('/developer/email-usage-stats', { method: 'GET' }),
    developerHeadcountStats: () => request('/developer/headcount-stats', { method: 'GET' }),
    developerPersonnelDetail: () => request('/developer/personnel-detail', { method: 'GET' }),
    setPersonnelFlag: (id, flagged) => request(`/developer/users/${encodeURIComponent(id)}/flag`, { method: 'PATCH', body: JSON.stringify({ flagged }) }),
    savePersonnelNotes: (id, notes) => request(`/developer/users/${encodeURIComponent(id)}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
    reviewerEnterprisePassword: () => request('/reviewer/enterprise-password', { method: 'GET' }),
    myDocumentsByOrganization: () => request('/employee/my-documents-by-organization', { method: 'GET' }),
    reviewerDocumentsByOrganization: () => request('/reviewer/documents-by-organization', { method: 'GET' }),
    organizationsDirectory: () => request('/organizations/directory', { method: 'GET' }),
    lobbyContent: () => request('/organizations/lobby-content', { method: 'GET' }),
    requestJoinOrganization: (id) => request(`/organizations/${encodeURIComponent(id)}/join-request`, { method: 'POST' }),
    requestLeaveOrganization: (id) => request(`/organizations/${encodeURIComponent(id)}/leave-request`, { method: 'POST' }),
    reviewerOrgMembershipRequests: () => request('/reviewer/org-membership-requests', { method: 'GET' }),
    reviewOrgMembershipAsReviewer: (id, action) => request(`/reviewer/org-membership-requests/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
    developerOrgMembershipRequests: () => request('/developer/org-membership-requests', { method: 'GET' }),
    reviewOrgMembershipAsDeveloper: (id, action) => request(`/developer/org-membership-requests/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
    developerLobbyContent: () => request('/developer/lobby-content', { method: 'GET' }),
    saveLobbyContent: (payload) => request('/developer/lobby-content', { method: 'PUT', body: JSON.stringify(payload) }),
    forgotPassword: (username, enterprisePassword, verificationCode) => request('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ username, enterprise_password: enterprisePassword, verification_code: verificationCode }), skipAuthRedirect: true,
    }),
    setUserActive: (id, active) => request(`/developer/users/${encodeURIComponent(id)}/${active ? 'enable' : 'disable'}`, { method: 'POST' }),
    changeUserRole: (id, targetRole) => request(`/developer/users/${encodeURIComponent(id)}/change_role`, { method: 'POST', body: JSON.stringify({ target_role: targetRole }) }),
    resetUserPassword: (id) => request(`/developer/users/${encodeURIComponent(id)}/reset_password`, { method: 'POST' }),
    uploadDocument: (file, organizationId) => {
      const formData = new FormData();
      formData.append('file', file);
      // 归属组织必填：后端不做"只加入一个组织就自动推断"的默认逻辑
      formData.append('organization_id', organizationId);
      return request('/documents/upload', {
        method: 'POST',
        body: formData,
        json: false,
      });
    },
    inputKnowledge: (title, content, organizationId) =>
      request('/knowledge/input', {
        method: 'POST',
        body: JSON.stringify({ title, content, organization_id: organizationId }),
      }),
    listDocuments: () => request('/documents', { method: 'GET' }),
    listVerifiedDocuments: (organizationId = null) => request(
      `/documents/verified${organizationId === null ? '' : `?organization_id=${encodeURIComponent(organizationId)}`}`,
      { method: 'GET' },
    ),
    pendingDocuments: (organizationId = null) => request(
      `/pending${organizationId === null ? '' : `?organization_id=${encodeURIComponent(organizationId)}`}`,
      { method: 'GET' },
    ),
    approveDocument: (docId) => request(`/approve/${encodeURIComponent(docId)}`, { method: 'POST' }),
    rejectDocument: (docId) => request(`/reject/${encodeURIComponent(docId)}`, { method: 'POST' }),
    previewDocument: (docId) => request(`/documents/${encodeURIComponent(docId)}/preview`, { method: 'GET' }),
    deleteDocument: (docId) => request(`/documents/${docId}`, { method: 'DELETE' }),
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
    rateLimits: () => request('/developer/rate-limits', { method: 'GET' }),
    saveRateLimits: (limits) => request('/developer/rate-limits', {
      method: 'PUT',
      body: JSON.stringify(limits),
    }),
    listOrganizations: () => request('/developer/organizations', { method: 'GET' }),
    createOrganization: (name, content) => request('/developer/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    }),
    updateOrganization: (id, payload) => request(`/developer/organizations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
    deleteOrganization: (id) => request(`/developer/organizations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  };
})();



