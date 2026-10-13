/* 成员移出与开发者注销；文件名、邮箱等展示只作纯文本。 */
(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function rows(members) {
    return members.length ? members.map(item => `<tr><td>${escape(item.username)}</td><td>${escape(item.organization_name)}</td>` +
      `<td><button class="danger" data-member="${escape(item.user_id)}" data-org="${escape(item.organization_id)}">移出组织</button></td></tr>`).join('')
      : '<tr><td colspan="3">暂无可移出的组织成员</td></tr>';
  }

  async function removeMember(api, role, item, confirm) {
    if (!confirm(`确认将该成员移出“${item.organization_name}”？立即生效。`)) return false;
    await api.removeOrganizationMember(role, item.organization_id, item.user_id);
    return true;
  }

  async function requestDeletion(api, password, code, confirm) {
    if (!password || !/^\d{6}$/.test(code)) throw Error('请填写当前密码和6位邮箱验证码');
    if (!confirm('确认申请注销当前开发者账号？7 天后生效，期间重新登录即撤销。其他角色账号不受影响。')) return null;
    return api.requestAccountDeletion(password, code);
  }

  function mount({ document, api, role, storage, sessionStorage, location, confirm }) {
    const members = document.querySelector('#internalMembersTable');
    const status = document.querySelector('#internalMembersStatus');
    const refresh = document.querySelector('#refreshInternalMembers');
    if (!members || !refresh) return;
    async function load() {
      try {
        const data = await api.organizationMembers(role);
        const items = Array.isArray(data.members) ? data.members : [];
        members.innerHTML = rows(items);
        members.querySelectorAll('[data-member]').forEach(button => button.addEventListener('click', async () => {
          const item = items.find(value => value.user_id === button.dataset.member && String(value.organization_id) === button.dataset.org);
          if (!item) return;
          button.disabled = true;
          try {
            if (await removeMember(api, role, item, confirm)) { status.textContent = '已移出组织'; await load(); }
          } catch (error) { status.textContent = api.errorMessage(error); }
          finally { button.disabled = false; }
        }));
      } catch (error) { status.textContent = api.errorMessage(error); }
    }
    refresh.addEventListener('click', load);
    load();
    const notice = sessionStorage.getItem('lifecycle_notice');
    if (notice) { status.textContent = notice; sessionStorage.removeItem('lifecycle_notice'); }
    if (role !== 'developer') return;
    const form = document.querySelector('#developerDeletionForm');
    const password = document.querySelector('#developerDeletionPassword');
    const code = document.querySelector('#developerDeletionCode');
    const send = document.querySelector('#sendDeveloperDeletionCode');
    const submit = document.querySelector('#submitDeveloperDeletion');
    const message = document.querySelector('#developerDeletionStatus');
    const clear = () => { password.value = ''; code.value = ''; };
    document.querySelector('#cancelDeveloperDeletion').addEventListener('click', clear);
    send.addEventListener('click', async () => {
      send.disabled = true;
      try {
        const options = await api.deletionOptions();
        if (!options.allowed) throw Error('默认账号或唯一启用中的开发者不能注销');
        await api.sendVerificationCode(options.email, 'customer_delete_account');
        message.textContent = '验证码已发送，请查收邮箱';
      } catch (error) { message.textContent = api.errorMessage(error); }
      finally { send.disabled = false; }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const result = await requestDeletion(api, password.value, code.value, confirm);
        if (!result) return;
        clear();
        // 只移除当前角色；同邮箱其他角色和其他已登录账号保留。
        const active = api.getActiveAccount();
        if (active) api.removeSavedAccount(active.username, active.role);
        api.logout();
        sessionStorage.setItem('auth_notice', result.detail);
        location.replace('./login.html');
      } catch (error) { message.textContent = api.errorMessage(error); }
      finally { submit.disabled = false; }
    });
  }

  if (typeof module !== 'undefined') module.exports = { rows, removeMember, requestDeletion, mount };
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const role = localStorage.getItem('user_role');
      if (['developer', 'reviewer'].includes(role)) mount({ document, api: API, role,
        storage: localStorage, sessionStorage, location, confirm: message => window.confirm(message) });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
