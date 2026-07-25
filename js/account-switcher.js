// 多身份快速切换：由 developer/reviewer/employee 三个工作台共用。
// 纯前端本地状态管理，不改动后端登录与权限逻辑；token 过期仍由后端 JWT 判定，
// 只有 API 实际返回 401 时才在 api.js 中清除对应记录。
const AccountSwitcher = (() => {
  const ROLE_LABELS = {
    developer: '开发者',
    reviewer: '审核员',
    employee: '员工',
  };
  const ROLE_PAGES = {
    developer: './developer.html',
    reviewer: './reviewer.html',
    employee: './employee.html',
  };

  function roleLabel(role) {
    return ROLE_LABELS[role] || role || '-';
  }

  function pageForRole(role) {
    return ROLE_PAGES[role] || './login.html';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function render(container) {
    const active = API.getActiveAccount();
    const accounts = API.getSavedAccounts();
    const activeLabel = active
      ? `${escapeHtml(active.username)} · ${escapeHtml(roleLabel(active.role))}`
      : '未登录';
    const options = accounts.map((item) => {
      const isActive = Boolean(active)
        && item.username === active.username
        && item.role === active.role;
      return `
        <button type="button" class="account-option${isActive ? ' is-active' : ''}"
                data-username="${escapeHtml(item.username)}" data-role="${escapeHtml(item.role)}">
          <span class="account-option-name">${escapeHtml(item.username)}</span>
          <span class="account-option-role">${escapeHtml(roleLabel(item.role))}</span>
        </button>`;
    }).join('');

    container.innerHTML = `
      <button type="button" id="accountSwitcherToggle" class="account-switcher-toggle"
              aria-expanded="false" aria-haspopup="true">
        <span class="account-switcher-current">${activeLabel}</span>
        <span class="account-switcher-caret" aria-hidden="true">▾</span>
      </button>
      <div id="accountSwitcherMenu" class="account-switcher-menu hidden" role="menu">
        ${options || '<p class="muted account-empty">暂无已保存账号</p>'}
        <button type="button" id="addAccountOption" class="account-option account-add">+ 添加账号</button>
      </div>`;

    const toggle = container.querySelector('#accountSwitcherToggle');
    const menu = container.querySelector('#accountSwitcherMenu');
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = menu.classList.contains('hidden');
      menu.classList.toggle('hidden', !willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', (event) => {
      if (!container.contains(event.target)) {
        menu.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    container.querySelector('#addAccountOption').addEventListener('click', () => {
      // 不清空 saved_accounts，登录成功后按 username+role 追加或更新
      location.href = './login.html';
    });

    container.querySelectorAll('.account-option[data-username]').forEach((button) => {
      button.addEventListener('click', () => {
        const { username, role } = button.dataset;
        if (active && username === active.username && role === active.role) {
          menu.classList.add('hidden');
          return;
        }
        if (API.setActiveAccount(username, role)) {
          location.replace(pageForRole(role));
        }
      });
    });
  }

  function handleLogout() {
    const active = API.getActiveAccount();
    const remaining = active
      ? API.removeSavedAccount(active.username, active.role)
      : API.getSavedAccounts();
    API.logout();
    if (remaining.length) {
      const next = remaining[0];
      if (API.setActiveAccount(next.username, next.role)) {
        location.replace(pageForRole(next.role));
        return;
      }
    }
    location.replace('./login.html');
  }

  function mount() {
    const logoutButton = document.querySelector('#logoutButton');
    if (!logoutButton) return;
    const container = document.createElement('div');
    container.className = 'account-switcher';
    logoutButton.parentNode.insertBefore(container, logoutButton);
    render(container);
  }

  return { mount, handleLogout, roleLabel, pageForRole };
})();
