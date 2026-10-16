const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/reviewer.js'), 'utf8');

function loadFunction(name, nextName, documents) {
  const table = {innerHTML: '', querySelectorAll: () => []};
  const context = vm.createContext({
    document: {querySelector: () => table},
    selectedReviewerOrganization: {id: 7}, selectedUsageMonth: '',
    API: {pendingDocuments: async () => ({documents}), listVerifiedDocuments: async () => ({documents}), filename: String},
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    shortId: String, organizationLabel: () => '作品集',
    ZhitianTime: {formatLocalTime: () => '演示时间'},
    refreshUsageMonthOptions() {}, usageCellMarkup: () => '0 / 0',
    rowMessage: String, briefError: error => {throw error;},
  });
  vm.runInContext(source.slice(source.indexOf(`async function ${name}(`), source.indexOf(`async function ${nextName}(`)), context);
  return {context, table};
}

for (const [name, nextName] of [['loadPending', 'handlePendingAction'], ['loadDocuments', 'deleteDocument']]) {
  test(`${name} 显示提交人名字、打码邮箱、注销标记，不回退到内部ID`, async () => {
    const documents = ['演示员工', '12****89@example.com', '已注销用户', undefined].map((display, index) => ({
      doc_id: `doc-${index}`, source: '说明.md', uploaded_by: `PRIVATE-INTERNAL-ID-${index}`,
      uploaded_by_display_name: display,
    }));
    const {context, table} = loadFunction(name, nextName, documents);
    await context[name]();
    for (const expected of ['演示员工', '12****89@example.com', '已注销用户', '<td>-</td>']) assert.ok(table.innerHTML.includes(expected));
    assert.ok(!table.innerHTML.includes('PRIVATE-INTERNAL-ID'));
  });

  test(`${name} 提交人显示名按纯文本安全转义`, async () => {
    const {context, table} = loadFunction(name, nextName, [{doc_id:'doc', source:'说明.md', uploaded_by_display_name:'<img src=x onerror=alert(1)>'}]);
    await context[name]();
    assert.ok(table.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!table.innerHTML.includes('<img'));
  });
}

test('审核员页面同步脚本缓存参数，其他角色不直接展示提交人ID', () => {
  const html = fs.readFileSync(path.join(__dirname, '../reviewer.html'), 'utf8');
  assert.ok(html.includes('reviewer.js?v=uploader-name-20261016'));
  for (const page of ['employee', 'developer']) {
    const text = fs.readFileSync(path.join(__dirname, '../js/' + page + '.js'), 'utf8');
    assert.ok(!text.includes('item.uploaded_by'));
  }
});
