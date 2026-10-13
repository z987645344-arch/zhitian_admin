const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('账号管理区域、密码弹窗、脚本和专用列表入口已删除，CI使用新的移除检查', () => {
  const html = read('developer.html');
  assert.doesNotMatch(html, /accountManagementPanel|managedAccountsTable|accountResetDialog|account-management\.js/);
  assert.doesNotMatch(html, /<h2>账号管理<\/h2>/);
  assert.equal(fs.existsSync(path.join(root, 'js/account-management.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'tests/account_management.test.js')), false);
  assert.doesNotMatch(read('js/api.js'), /developerAccounts|\/developer\/accounts/);
  const ci = read('.github/workflows/ci.yml');
  assert.doesNotMatch(ci, /tests\/account_management\.test\.js/);
  assert.match(ci, /tests\/account_management_removal\.test\.js/);
});

test('企业授权、人员详情、组织移出、开发者注销和保留的账号操作API均未移除', () => {
  const html = read('developer.html');
  for (const id of ['enterpriseQuotaUsersTable', 'developerPersonnelTable', 'reviewerPersonnelTable',
                    'internalMembersTable', 'developerDeletionForm']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /js\/internal-lifecycle\.js/);
  const api = read('js/api.js');
  for (const name of ['setUserActive', 'changeUserRole', 'resetUserPassword', 'revokeEnterpriseApi',
                      'removeOrganizationMember', 'requestAccountDeletion']) {
    assert.ok(api.includes(name), name);
  }
  assert.match(html, /account-removal-20261014/);
});
