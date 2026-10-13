const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { restrictions, renderRows, perform, passwordDelivery, mount } = require('../js/account-management.js');

const full = '123456789@example.com';
const masked = '12****89@example.com';
const base = { user_id: 'u1', masked_account: masked, role: 'customer', status: 'enabled', is_default_account: false,
  created_at: '2026-10-13', last_login_at: null, custom_organization_count: 2, api_quota_source: 'enterprise', email: full };
const meta = { current_user_id: 'operator', last_enabled_developer_id: 'last' };
const render = (items, grants = new Set(), members = [], role = '') => renderRows(items, meta, grants, members, role, value => value || '-');

test('账号表只渲染打码字段和要求的列，角色筛选，空列表，文本转义', () => {
  const html = render([base, { ...base, user_id: 'reviewer', role: 'reviewer', masked_account: '&<script>' }]);
  assert.ok(html.includes(masked));
  assert.ok(!html.includes(full));
  for (const label of ['启用', '企业', '禁用', '修改角色', '重置密码']) assert.ok(html.includes(label));
  assert.ok(html.includes('&amp;&lt;script&gt;'));
  assert.ok(!render([base], new Set(), [], 'reviewer').includes(masked));
  assert.ok(render([]).includes('暂无符合条件的账号'));
});

test('默认、最后开发者、自身及待注销危险按钮置灰并说明原因；禁用账号可启用', () => {
  for (const [item, pattern] of [
    [{ ...base, is_default_account: true }, /默认账号/],
    [{ ...base, user_id: 'last', role: 'developer' }, /最后一个启用中的开发者/],
    [{ ...base, user_id: 'operator', role: 'developer' }, /自己的/],
  ]) {
    const reasons = restrictions(item, meta);
    assert.match(reasons.active, pattern); assert.match(reasons.role, pattern);
    assert.match(render([item]), /data-account-action="disable" disabled title=/);
    assert.match(render([item]), /data-account-action="change_role" disabled title=/);
  }
  assert.match(render([{ ...base, status: 'disabled' }]), /data-account-action="enable">启用/);
  const pending = { ...base, status: 'pending_deletion' };
  assert.match(restrictions(pending, meta).role, /待注销/);
  assert.match(render([pending]), /data-account-action="enable">启用/);
  assert.match(render([pending]), /启用不会撤销注销/);
});

test('只给已授权客户显示回收；移出组织下拉仅取服务端允许的成员范围', () => {
  const members = [{ user_id: 'u1', organization_id: 2, organization_name: 'Synthetic' },
    { user_id: 'other', organization_id: 3, organization_name: 'OTHER' }];
  assert.match(render([base], new Set(['u1']), members), /回收企业授权/);
  assert.doesNotMatch(render([{ ...base, role: 'employee' }], new Set(['u1'])), /回收企业授权/);
  assert.doesNotMatch(render([base]), /回收企业授权|移出组织/);
  const html = render([base], new Set(), members);
  assert.match(html, /value="2">Synthetic/); assert.doesNotMatch(html, /OTHER/);
});

test('全部确认取消零请求，确认弹窗不出现完整邮箱', async () => {
  const api = new Proxy({}, { get() { return () => { throw Error('不应发请求'); }; } });
  for (const action of ['disable', 'enable', 'change_role', 'reset_password', 'revoke', 'remove']) {
    const result = await perform(api, base, action, action === 'change_role' ? 'employee' : 2, message => {
      assert.ok(message.includes(masked)); assert.ok(!message.includes(full)); return false;
    });
    assert.equal(result, null);
  }
});

test('确认后精确调用已有接口，组织移出仍使用developer权限', async () => {
  const calls = [];
  const api = Object.fromEntries(['setUserActive', 'changeUserRole', 'resetUserPassword', 'revokeEnterpriseApi', 'removeOrganizationMember']
    .map(name => [name, async (...args) => { calls.push([name, ...args]); return {}; }]));
  for (const action of ['disable', 'enable', 'change_role', 'reset_password', 'revoke', 'remove'])
    await perform(api, base, action, action === 'change_role' ? 'reviewer' : 2, () => true);
  assert.deepEqual(calls, [['setUserActive', 'u1', false], ['setUserActive', 'u1', true], ['changeUserRole', 'u1', 'reviewer'],
    ['resetUserPassword', 'u1'], ['revokeEnterpriseApi', 'u1'], ['removeOrganizationMember', 'developer', 2, 'u1']]);
});

function element() {
  return { textContent: '', value: '', handlers: {}, disabled: false, addEventListener(event, handler) { this.handlers[event] = handler; } };
}

test('新密码仅纯文本显示一次，关闭或Escape后连复制也拿不到，不写存储', async () => {
  const dialog = { ...element(), showModal() { this.open = true; }, close() { this.open = false; this.handlers.close(); } };
  const value = element(), label = element(), copy = element(), status = element(), copied = [];
  Object.defineProperty(value, 'innerHTML', { set() { throw Error('密码不能作为HTML'); } });
  const delivery = passwordDelivery(dialog, value, label, copy, status, { writeText: async text => copied.push(text) });
  delivery.show('SyntheticPassword123!', masked);
  assert.equal(value.textContent, 'SyntheticPassword123!'); assert.equal(label.textContent, masked);
  assert.ok(!label.textContent.includes(full));
  await copy.handlers.click(); assert.deepEqual(copied, ['SyntheticPassword123!']);
  delivery.close(); assert.equal(value.textContent, ''); assert.equal(label.textContent, '');
  await copy.handlers.click(); assert.equal(copied.length, 1);
  delivery.show('AnotherPassword123!', masked);
  dialog.handlers.cancel(); await copy.handlers.click(); assert.equal(value.textContent, ''); assert.equal(copied.length, 1);
  const source = fs.readFileSync(path.join(__dirname, '../js/account-management.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\.log/);
});

test('实际页面挂载读取专用最小接口，角色过滤与刷新接入', async () => {
  const nodes = {};
  for (const id of ['managedAccountsTable', 'managedAccountRole', 'managedAccountsStatus', 'accountResetDialog', 'accountResetPassword',
    'accountResetLabel', 'copyAccountResetPassword', 'accountResetCopyStatus', 'closeAccountResetPassword', 'refreshManagedAccounts']) nodes[id] = element();
  nodes.managedAccountsTable.querySelectorAll = () => [];
  const calls = [];
  const api = { developerAccounts: async () => { calls.push('accounts'); return { ...meta, accounts: [base] }; },
    developerEnterpriseCustomers: async () => ({ customers: [] }), organizationMembers: async role => { assert.equal(role, 'developer'); return { members: [] }; },
    errorMessage: error => error.message };
  mount({ document: { querySelector: selector => nodes[selector.slice(1)] }, api, confirm: () => false, clipboard: {}, formatTime: value => value || '-' });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(nodes.managedAccountsTable.innerHTML, /12\*\*\*\*89@example\.com/);
  assert.doesNotMatch(nodes.managedAccountsTable.innerHTML, /123456789@example\.com/);
  nodes.managedAccountRole.value = 'reviewer'; nodes.managedAccountRole.handlers.change();
  assert.match(nodes.managedAccountsTable.innerHTML, /暂无符合条件/);
  await nodes.refreshManagedAccounts.handlers.click(); assert.equal(calls.length, 2);
});

test('新表与密码弹窗真实接入，不修改旧表；API缓存更新、专用接口和CI测试接入', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const html = read('developer.html');
  for (const id of ['accountManagementPanel', 'accountResetDialog', 'enterpriseQuotaUsersTable', 'developerPersonnelTable', 'reviewerPersonnelTable'])
    assert.ok(html.includes(`id="${id}"`));
  assert.match(html, /account-management\.js/);
  assert.match(read('js/api.js'), /developerAccounts:.*\/developer\/accounts/);
  assert.match(read('.github/workflows/ci.yml'), /tests\/account_management\.test\.js/);
});

test('实际重置按钮只请求一次并交付密码，复制前不刷新接口，关闭后不再显示', async () => {
  const nodes = {};
  for (const id of ['managedAccountsTable', 'managedAccountRole', 'managedAccountsStatus', 'accountResetDialog', 'accountResetPassword',
    'accountResetLabel', 'copyAccountResetPassword', 'accountResetCopyStatus', 'closeAccountResetPassword', 'refreshManagedAccounts']) nodes[id] = element();
  nodes.accountResetDialog.showModal = function () { this.open = true; };
  nodes.accountResetDialog.close = function () { this.open = false; this.handlers.close(); };
  const control = { ...element(), dataset: { accountAction: 'reset_password' } };
  nodes.managedAccountsTable.querySelectorAll = () => [{ dataset: { accountId: 'u1' }, querySelectorAll: () => [control] }];
  const calls = { lists: 0, resets: 0, copies: [] };
  const api = { developerAccounts: async () => { calls.lists++; return { ...meta, accounts: [base] }; },
    developerEnterpriseCustomers: async () => ({ customers: [] }), organizationMembers: async () => ({ members: [] }),
    resetUserPassword: async id => { assert.equal(id, 'u1'); calls.resets++; return { new_password: 'SyntheticPassword123!' }; }, errorMessage: error => error.message };
  mount({ document: { querySelector: selector => nodes[selector.slice(1)] }, api,
    confirm: text => { assert.ok(text.includes(masked)); assert.ok(!text.includes(full)); return true; },
    clipboard: { writeText: async value => calls.copies.push(value) }, formatTime: value => value || '-' });
  await new Promise(resolve => setImmediate(resolve));
  await control.handlers.click();
  assert.equal(calls.resets, 1); assert.equal(calls.lists, 1);
  assert.equal(nodes.accountResetPassword.textContent, 'SyntheticPassword123!');
  assert.equal(nodes.accountResetLabel.textContent, masked);
  await nodes.copyAccountResetPassword.handlers.click();
  nodes.closeAccountResetPassword.handlers.click();
  await nodes.copyAccountResetPassword.handlers.click();
  assert.equal(nodes.accountResetPassword.textContent, ''); assert.equal(nodes.accountResetLabel.textContent, '');
  assert.deepEqual(calls.copies, ['SyntheticPassword123!']); assert.equal(calls.resets, 1);
});
