/* 独立账号管理区域：仅消费打码账号；一次性密码不进任何浏览器存储。 */
(function () {
  'use strict';
  const roles = { customer: '客户', employee: '员工', reviewer: '审核员', developer: '开发者' };
  const statuses = { enabled: '启用', disabled: '禁用', pending_deletion: '待注销' };
  const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function restrictions(item, metadata) {
    const self = item.user_id === metadata.current_user_id;
    const last = item.user_id === metadata.last_enabled_developer_id;
    return {
      active: item.is_default_account && item.status === 'enabled' ? '默认账号不能禁用'
        : last && item.status === 'enabled' ? '不能禁用最后一个启用中的开发者' : self ? '不能操作自己的账号' : '',
      role: item.is_default_account ? '默认账号不能修改角色' : last ? '不能降级最后一个启用中的开发者'
        : self ? '不能修改自己的角色' : item.status === 'pending_deletion' ? '待注销，须先解除待注销状态后再操作' : '',
      reset: self ? '不能操作自己的账号' : '',
    };
  }

  function button(action, label, reason = '') {
    return `<button data-account-action="${action}"${reason ? ` disabled title="${escape(reason)}"` : ''}>${label}</button>`
      + (reason ? `<small class="muted">${escape(reason)}</small>` : '');
  }

  function renderRows(accounts, metadata, authorized, members, roleFilter, formatTime) {
    const selected = accounts.filter(item => !roleFilter || item.role === roleFilter);
    return selected.length ? selected.map(item => {
      const reasons = restrictions(item, metadata);
      const organizations = members.filter(member => member.user_id === item.user_id);
      const options = Object.entries(roles).map(([value, label]) => `<option value="${value}"${value === item.role ? ' selected' : ''}>${label}</option>`).join('');
      const orgOptions = organizations.map(member => `<option value="${escape(member.organization_id)}">${escape(member.organization_name)}</option>`).join('');
      const quota = { enterprise: '企业', personal: '个人' }[item.api_quota_source] || '未配置';
      // 待注销状态遮蔽is_active；只提供安全、幂等的启用，不猜是否能禁用。
      const actions = button(item.status === 'enabled' ? 'disable' : 'enable', item.status === 'enabled' ? '禁用' : '启用', reasons.active)
        + (item.status === 'pending_deletion' ? '<small class="muted">启用不会撤销注销；仅自助注销冷静期可通过本人登录撤销</small>' : '')
        + `<select data-account-role${reasons.role ? ' disabled' : ''} aria-label="目标角色">${options}</select>` + button('change_role', '修改角色', reasons.role)
        + button('reset_password', '重置密码', reasons.reset)
        + (item.role === 'customer' && authorized.has(item.user_id) ? button('revoke', '回收企业授权') : '')
        + (orgOptions ? `<select data-account-org aria-label="选择组织">${orgOptions}</select>` + button('remove', '移出组织') : '');
      return `<tr data-account-id="${escape(item.user_id)}"><td>${escape(item.user_id)}</td><td>${escape(item.masked_account)}</td>`
        + `<td>${roles[item.role] || '-'}</td><td>${statuses[item.status] || '-'}</td><td>${item.is_default_account ? '是' : '否'}</td>`
        + `<td>${escape(formatTime(item.created_at))}</td><td>${escape(formatTime(item.last_login_at))}</td>`
        + `<td>${escape(item.custom_organization_count)}</td><td>${quota}</td><td><div class="actions">${actions}</div></td></tr>`;
    }).join('') : '<tr><td colspan="10">暂无符合条件的账号</td></tr>';
  }

  async function perform(api, item, action, value, confirm) {
    const descriptions = { disable: '禁用', enable: '启用', change_role: `修改为${roles[value] || ''}`,
      reset_password: '重置密码（同邮箱各角色旧登录将全部失效）', revoke: '回收企业授权', remove: '移出所选组织' };
    if (!Object.hasOwn(descriptions, action)) throw Error('不支持的操作');
    if (!confirm(`确认对 ${item.masked_account} 执行“${descriptions[action]}”？`)) return null;
    if (action === 'disable' || action === 'enable') return api.setUserActive(item.user_id, action === 'enable');
    if (action === 'change_role') return api.changeUserRole(item.user_id, value);
    if (action === 'reset_password') return api.resetUserPassword(item.user_id);
    if (action === 'revoke') return api.revokeEnterpriseApi(item.user_id);
    return api.removeOrganizationMember('developer', value, item.user_id);
  }

  function passwordDelivery(dialog, value, label, copy, status, clipboard) {
    let secret = '';
    const clear = () => { secret = ''; value.textContent = ''; label.textContent = ''; status.textContent = ''; };
    dialog.addEventListener('close', clear);
    dialog.addEventListener('cancel', clear);
    copy.addEventListener('click', async () => {
      if (!secret) return;
      try { await clipboard.writeText(secret); status.textContent = '已复制'; }
      catch { status.textContent = '复制失败，请手动复制'; }
    });
    return { show(password, maskedAccount) {
      clear(); secret = password; value.textContent = secret; label.textContent = maskedAccount;
      dialog.showModal();
    }, close() { clear(); dialog.close(); } };
  }

  function mount({ document, api, confirm, clipboard, formatTime }) {
    const table = document.querySelector('#managedAccountsTable');
    const filter = document.querySelector('#managedAccountRole');
    const status = document.querySelector('#managedAccountsStatus');
    if (!table) return;
    let accounts = [], metadata = {}, members = [], authorized = new Set();
    const dialog = document.querySelector('#accountResetDialog');
    const password = passwordDelivery(dialog, document.querySelector('#accountResetPassword'), document.querySelector('#accountResetLabel'),
      document.querySelector('#copyAccountResetPassword'), document.querySelector('#accountResetCopyStatus'), clipboard);
    document.querySelector('#closeAccountResetPassword').addEventListener('click', password.close);
    function render() {
      table.innerHTML = renderRows(accounts, metadata, authorized, members, filter.value, formatTime);
      table.querySelectorAll('[data-account-id]').forEach(element => {
        const item = accounts.find(account => account.user_id === element.dataset.accountId);
        element.querySelectorAll('[data-account-action]').forEach(control => control.addEventListener('click', async () => {
          if (control.disabled) return;
          control.disabled = true;
          try {
            const action = control.dataset.accountAction;
            const value = action === 'change_role' ? element.querySelector('[data-account-role]').value
              : action === 'remove' ? element.querySelector('[data-account-org]').value : null;
            const result = await perform(api, item, action, value, confirm);
            if (!result) return;
            if (action === 'reset_password') {
              // 先交付一次性密码；同邮箱操作者的token也可能已失效，不能刷新接口抢先跳转。
              password.show(result.new_password, item.masked_account);
              status.textContent = '密码已重置；关闭弹窗后不再显示，请先保存';
            } else { status.textContent = '操作成功'; await load(); }
          } catch (error) { status.textContent = api.errorMessage(error); }
          finally { control.disabled = false; }
        }));
      });
    }
    async function load() {
      try {
        const [data, grants, organizations] = await Promise.all([api.developerAccounts(), api.developerEnterpriseCustomers(), api.organizationMembers('developer')]);
        accounts = data.accounts; metadata = data;
        authorized = new Set(grants.customers.map(item => item.user_id));
        members = organizations.members; render();
      } catch (error) { status.textContent = api.errorMessage(error); }
    }
    filter.addEventListener('change', render);
    document.querySelector('#refreshManagedAccounts').addEventListener('click', load);
    load();
  }

  if (typeof module !== 'undefined') module.exports = { restrictions, renderRows, perform, passwordDelivery, mount };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
    if (API.ensureRole('developer')) mount({ document, api: API, confirm: message => window.confirm(message),
      clipboard: navigator.clipboard, formatTime: value => ZhitianTime.formatLocalTime(value) });
  });
})();
