const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { rows, removeMember, requestDeletion, mount } = require('../js/internal-lifecycle.js');

test('成员列表只渲染后端允许的成员，安全转义，有移出按钮和空提示', () => {
  const html = rows([{ user_id: 'u1', username: '<script>@example.com', organization_id: 2, organization_name: '<img>' }]);
  assert.match(html, /移出组织/);
  assert.match(html, /data-org="2"/);
  assert.doesNotMatch(html, /<script>|<img>/);
  assert.match(rows([]), /暂无可移出的组织成员/);
});

test('移出确认取消零请求，确认后仅提交指定角色组织成员', async () => {
  const calls = [];
  const api = { removeOrganizationMember: async (...args) => calls.push(args) };
  const item = { user_id: 'u1', organization_id: 2, organization_name: 'Synthetic' };
  assert.equal(await removeMember(api, 'reviewer', item, () => false), false);
  assert.equal(calls.length, 0);
  assert.equal(await removeMember(api, 'reviewer', item, () => true), true);
  assert.deepEqual(calls, [['reviewer', 2, 'u1']]);
});

test('开发者注销取消零请求，错误输入零请求，确认后提交密码与验证码', async () => {
  const calls = [];
  const api = { requestAccountDeletion: async (...args) => { calls.push(args); return { detail: '申请已提交' }; } };
  assert.equal(await requestDeletion(api, 'SyntheticPassword!', '123456', () => false), null);
  await assert.rejects(requestDeletion(api, '', '123456', () => true), /当前密码/);
  await assert.rejects(requestDeletion(api, 'SyntheticPassword!', 'bad', () => true), /验证码/);
  assert.equal(calls.length, 0);
  assert.equal((await requestDeletion(api, 'SyntheticPassword!', '123456', () => true)).detail, '申请已提交');
  assert.deepEqual(calls, [['SyntheticPassword!', '123456']]);
});

function environment(confirm = true) {
  const elements = {};
  const ids = ['internalMembersTable', 'internalMembersStatus', 'refreshInternalMembers', 'developerDeletionForm',
    'developerDeletionPassword', 'developerDeletionCode', 'sendDeveloperDeletionCode', 'submitDeveloperDeletion',
    'developerDeletionStatus', 'cancelDeveloperDeletion'];
  ids.forEach(id => { elements[id] = { value: '', disabled: false, textContent: '', handlers: {},
    querySelectorAll: () => [], addEventListener(event, callback) { this.handlers[event] = callback; } }; });
  const calls = { send: [], deletion: [], removed: [], logout: 0, location: [], notices: {} };
  const api = { organizationMembers: async () => ({ members: [] }),
    deletionOptions: async () => ({ allowed: true, email: 'developer@example.com' }),
    sendVerificationCode: async (...args) => calls.send.push(args),
    requestAccountDeletion: async (...args) => { calls.deletion.push(args); return { detail: '7 天后生效' }; },
    getActiveAccount: () => ({ username: 'developer@example.com', role: 'developer' }),
    removeSavedAccount: (...args) => calls.removed.push(args), logout: () => calls.logout++, errorMessage: error => error.message };
  const sessionStorage = { getItem: key => calls.notices[key], setItem: (key, value) => { calls.notices[key] = value; },
    removeItem: key => delete calls.notices[key] };
  mount({ document: { querySelector: selector => elements[selector.slice(1)] }, api, role: 'developer',
    sessionStorage, location: { replace: target => calls.location.push(target) }, confirm: () => confirm });
  return { elements, calls, api };
}

test('注销表单发送验证码，成功后只退出当前角色，不保存密码验证码', async () => {
  const env = environment();
  await env.elements.sendDeveloperDeletionCode.handlers.click();
  assert.deepEqual(env.calls.send, [['developer@example.com', 'customer_delete_account']]);
  env.elements.developerDeletionPassword.value = 'SyntheticPassword!';
  env.elements.developerDeletionCode.value = '123456';
  await env.elements.developerDeletionForm.handlers.submit({ preventDefault() {} });
  assert.deepEqual(env.calls.removed, [['developer@example.com', 'developer']]);
  assert.equal(env.calls.logout, 1);
  assert.deepEqual(env.calls.location, ['./login.html']);
  assert.equal(env.elements.developerDeletionPassword.value, '');
  assert.equal(env.elements.developerDeletionCode.value, '');
  assert.doesNotMatch(JSON.stringify(env.calls.notices), /SyntheticPassword|123456/);
});

test('默认或唯一开发者不得发送验证码，取消清空输入，失败恢复按钮', async () => {
  const env = environment(false);
  env.api.deletionOptions = async () => ({ allowed: false });
  await env.elements.sendDeveloperDeletionCode.handlers.click();
  assert.equal(env.calls.send.length, 0);
  assert.match(env.elements.developerDeletionStatus.textContent, /唯一/);
  env.elements.developerDeletionPassword.value = 'SyntheticPassword!';
  env.elements.developerDeletionCode.value = '123456';
  await env.elements.developerDeletionForm.handlers.submit({ preventDefault() {} });
  assert.equal(env.calls.deletion.length, 0);
  env.elements.cancelDeveloperDeletion.handlers.click();
  assert.equal(env.elements.developerDeletionPassword.value, '');
  assert.equal(env.elements.submitDeveloperDeletion.disabled, false);
});

test('两个成员管理页面接入脚本；仅开发者有注销卡片，登录撤销提示接入', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  for (const page of ['developer.html', 'reviewer.html']) {
    assert.match(read(page), /id="internalMembersTable"/);
    assert.match(read(page), /internal-lifecycle.js/);
  }
  assert.match(read('developer.html'), /id="developerDeletionForm"/);
  assert.doesNotMatch(read('reviewer.html'), /developerDeletionForm/);
  assert.match(read('js/login.js'), /已撤销注销申请/);
});
