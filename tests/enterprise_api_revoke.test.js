const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/developer.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../developer.html'), 'utf8');
const apiSource = fs.readFileSync(path.join(__dirname, '../js/api.js'), 'utf8');

function environment({ confirm = true, prompt = '确认回收', users = [], error = false } = {}) {
  let customers = [...users];
  const calls = { single: [], bulk: 0, list: 0, confirm: [], prompt: [] };
  const title = { textContent: '' }, status = { textContent: '' }, bulk = { disabled: false }, table = { innerHTML: '', buttons: [],
    querySelectorAll() {
      this.buttons = [...this.innerHTML.matchAll(/data-revoke-enterprise="([^"]*)" data-user-label="([^"]*)"/g)]
        .map(match => ({ dataset: { revokeEnterprise: match[1], userLabel: match[2] }, disabled: false,
          addEventListener(event, callback) { this.click = callback; } }));
      return this.buttons;
    } };
  const context = vm.createContext({
    window: {
      confirm: message => { calls.confirm.push(message); return confirm; },
      prompt: message => { calls.prompt.push(message); return prompt; },
    },
    document: { querySelector: selector => ({ '#enterpriseQuotaUsersTable': table,
      '#enterpriseQuotaStatus': status, '#enterpriseQuotaTitle': title, '#revokeAllEnterpriseApi': bulk }[selector] || {}) },
    ZhitianTime: { formatLocalTime: value => value ? 'LOCAL:' + value : '-' },
    API: {
      ensureRole: () => false,
      errorMessage: error => error.message,
      developerUsers: async () => { throw Error('授权表不得读取完整用户列表'); },
      developerEnterpriseCustomers: async () => { calls.list++; return { customers }; },
      revokeEnterpriseApi: async id => { calls.single.push(id); if (error) throw Error('请求失败');
        customers = customers.filter(item => item.user_id !== id); return { revoked: true }; },
      revokeAllEnterpriseApi: async () => { calls.bulk++; if (error) throw Error('请求失败'); customers = []; return { revoked_count: 3 }; },
    },
  });
  vm.runInContext(source, context);
  return { calls, status, title, bulk, table, context, fn: name => vm.runInContext(name, context) };
}

test('授权客户表只有账号授权时间操作三列，字段安全转义，回收后移除', async () => {
  const users = [
    { user_id: 'u1', masked_account: '<img****>', enterprise_api_authorized_at: '2026-10-12T00:00:00Z' },
    { user_id: 'u2', masked_account: '12****89@example.com', enterprise_api_authorized_at: '2026-10-11T00:00:00Z' },
  ];
  const env = environment({ users });
  assert.equal(await env.fn('loadEnterpriseQuotaUsers')(), true);
  assert.match(html, /<th>账号<\/th><th>授权时间<\/th><th>操作<\/th>/);
  assert.match(html, /id="revokeAllEnterpriseApi"[^>]*>一键回收全部企业授权/);
  assert.match(env.table.innerHTML, /<td>12\*\*\*\*89@example.com<\/td>/);
  assert.doesNotMatch(env.table.innerHTML, /<td>(企业|个人|未配置|员工|客户)<\/td>/);
  assert.equal(env.title.textContent, '企业授权中的客户（2）');
  assert.match(env.table.innerHTML, /LOCAL:2026-10-12T00:00:00Z/);
  assert.equal(env.table.buttons.length, 2);
  assert.doesNotMatch(env.table.innerHTML, /<img|<script/);
  assert.match(env.table.innerHTML, /&lt;img/);
  const originalButton = env.table.buttons[0];
  await originalButton.click();
  assert.deepEqual(env.calls.single, ['u1']);
  assert.equal(env.calls.list, 2);
  assert.equal(env.status.textContent, '企业授权已回收');
  assert.equal(env.table.buttons[0].disabled, false);
  assert.equal(originalButton.disabled, false);
  assert.equal(env.title.textContent, '企业授权中的客户（1）');
  assert.doesNotMatch(env.table.innerHTML, /data-revoke-enterprise="u1"/);
  assert.match(env.calls.confirm[0], /确认回收/);
});

test('单个回收取消确认不发请求，也不刷新列表', async () => {
  const env = environment({ confirm: false });
  const button = { dataset: { revokeEnterprise: 'u1', userLabel: 'user' }, disabled: false };
  await env.fn('revokeEnterpriseApiForUser')(button);
  assert.deepEqual(env.calls.single, []);
  assert.equal(env.calls.list, 0);
  assert.equal(button.disabled, false);
});

for (const [confirm, prompt] of [[false, '确认回收'], [true, null], [true, '取消'], [true, '确认回收 ']]) {
  test(`全部回收未完成二次确认时不发请求 (${confirm}/${prompt})`, async () => {
    const env = environment({ confirm, prompt });
    await env.fn('revokeAllEnterpriseApi')();
    assert.equal(env.calls.bulk, 0);
    assert.equal(env.calls.list, 0);
    assert.equal(env.bulk.disabled, false);
    assert.equal(env.calls.prompt.length, confirm ? 1 : 0);
  });
}

test('全部回收正确二次确认后发一次请求，显示人数并刷新', async () => {
  const env = environment();
  await env.fn('revokeAllEnterpriseApi')();
  assert.equal(env.calls.confirm.length, 1);
  assert.match(env.calls.confirm[0], /^确认回收全部客户的企业授权？/);
  assert.equal(env.calls.prompt.length, 1);
  assert.equal(env.calls.bulk, 1);
  assert.equal(env.calls.list, 1);
  assert.equal(env.status.textContent, '已回收 3 人的企业授权');
  assert.equal(env.bulk.disabled, false);
});

test('请求失败恢复按钮并显示可读原因，不重复请求', async () => {
  const env = environment({ error: true });
  await env.fn('revokeAllEnterpriseApi')();
  assert.equal(env.status.textContent, '请求失败');
  assert.equal(env.bulk.disabled, false);
  assert.equal(env.calls.bulk, 1);
  assert.equal(env.calls.list, 0);
});

test('开发者页初次加载、手动刷新与回收按钮均接入授权管理', () => {
  assert.match(source, /#revokeAllEnterpriseApi'\)\.addEventListener\('click', revokeAllEnterpriseApi\)/);
  assert.match(source, /#refreshEnterpriseQuotaUsers'\)\.addEventListener\('click', loadEnterpriseQuotaUsers\)/);
  assert.match(source, /loadPersonnelOverview\(\), loadEnterpriseQuotaUsers\(\)/);
  assert.match(html, /js\/api\.js\?v=enterprise-api-revoke-20261012/);
  assert.match(html, /js\/developer\.js\?v=enterprise-api-revoke-20261012/);
});

test('API请求使用鉴权、编码用户ID和精确确认字段，不发送密钥', async () => {
  const requests = [];
  const context = vm.createContext({ window: {}, localStorage: { getItem: key => key === 'auth_token' ? 'test-token' : null },
    fetch: async (url, options) => {
      requests.push([url, options]);
      return { ok: true, status: 200, text: async () => JSON.stringify({ revoked_count: 1 }) };
    } });
  vm.runInContext(apiSource, context);
  const api = vm.runInContext('API', context);
  await api.revokeEnterpriseApi('id/with space');
  await api.revokeAllEnterpriseApi();
  assert.equal(requests[0][0], '/api/developer/users/id%2Fwith%20space/enterprise-api/revoke');
  assert.equal(requests[0][1].method, 'POST');
  assert.equal(requests[0][1].body, undefined);
  assert.equal(requests[1][0], '/api/developer/enterprise-api/revoke-all');
  assert.deepEqual(JSON.parse(requests[1][1].body), { confirm: 'REVOKE_ALL_ENTERPRISE_API' });
  for (const [, options] of requests) assert.equal(options.headers.Authorization, 'Bearer test-token');
});

test('空授权表显示零人数与专用提示', async () => {
  const env = environment();
  assert.equal(await env.fn('loadEnterpriseQuotaUsers')(), true);
  assert.equal(env.title.textContent, '企业授权中的客户（0）');
  assert.match(env.table.innerHTML, /暂无企业授权中的客户/);
  assert.equal(env.table.buttons.length, 0);
});

test('只渲染专用接口返回的打码账号，确认框也不含完整邮箱', async () => {
  const env = environment({ users: [{ user_id: 'only-row', masked_account: '12****89@example.com',
    enterprise_api_authorized_at: '2026-10-12T00:00:00Z' }] });
  await env.fn('loadEnterpriseQuotaUsers')();
  assert.equal(env.table.buttons.length, 1);
  assert.doesNotMatch(env.table.innerHTML, /123456789@example\.com/);
  await env.table.buttons[0].click();
  assert.match(env.calls.confirm[0], /12\*\*\*\*89@example\.com/);
  assert.doesNotMatch(env.calls.confirm[0], /123456789@example\.com/);
  assert.equal(env.title.textContent, '企业授权中的客户（0）');
  assert.match(env.table.innerHTML, /暂无企业授权中的客户/);
});

test('专用客户列表API是只读鉴权请求', async () => {
  const requests = [];
  const context = vm.createContext({ window: {}, localStorage: { getItem: () => 'test-token' },
    fetch: async (url, options) => {
      requests.push([url, options]);
      return { ok: true, status: 200, text: async () => JSON.stringify({ customers: [] }) };
    } });
  vm.runInContext(apiSource, context);
  await vm.runInContext('API', context).developerEnterpriseCustomers();
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], '/api/developer/enterprise-api/customers');
  assert.equal(requests[0][1].method, undefined);
  assert.equal(requests[0][1].body, undefined);
  assert.equal(requests[0][1].headers.Authorization, 'Bearer test-token');
});
