const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const apiSource = fs.readFileSync(path.join(__dirname, '../js/api.js'), 'utf8');

function loadApi(detail = {}) {
  const sandbox = vm.createContext({ window: {}, localStorage: { getItem: () => '' }, FormData,
    fetch: async () => ({ ok: false, status: 409, text: async () => JSON.stringify({ detail }) }) });
  vm.runInContext(apiSource, sandbox);
  return { sandbox, api: vm.runInContext('API', sandbox) };
}

test('上传对象detail显示可读原因，其他API使用同一错误转换', async () => {
  const { api } = loadApi({ message: '该文件已上传过', doc_id: 'not-for-display', source: 'private' });
  await assert.rejects(api.uploadDocument(new Blob(['test']), 1), { message: '该文件已上传过' });
  await assert.rejects(api.inputKnowledge('title', 'content', 1), { message: '该文件已上传过' });
});

test('字符串、嵌套detail和校验数组可读；未知对象不输出对象或原始输入', async () => {
  const cases = [['权限不足', '权限不足'], [{ message: '重复上传' }, '重复上传'],
    [{ detail: { message: '无权操作' } }, '无权操作'], [{ message: {} }, '请求失败：HTTP 409'],
    [{ doc_id: 'PRIVATE' }, '请求失败：HTTP 409'],
    [[{ msg: '字段缺失', input: 'SECRET' }, { msg: '格式无效' }], '字段缺失；格式无效'],
    [null, '请求失败：HTTP 409']];
  for (const [detail, expected] of cases) {
    await assert.rejects(loadApi(detail).api.listDocuments(), { message: expected });
  }
  const { api } = loadApi();
  assert.equal(api.errorMessage({ message: {} }), '请求失败，请稍后重试');
  assert.equal(api.errorMessage(new Error('网络中断')), '网络中断');
  const cycle = {}; cycle.detail = cycle;
  assert.equal(api.errorMessage(cycle), '请求失败，请稍后重试');
});

test('所有页面的错误展示统一提取可读文案，不直接字符串化对象', () => {
  for (const page of ['employee', 'reviewer', 'developer', 'login', 'org-lobby']) {
    const source = fs.readFileSync(path.join(__dirname, '../js/' + page + '.js'), 'utf8');
    const start = source.indexOf('function briefError(error)');
    const tail = source.slice(start);
    const firstLine = tail.split('\n')[0];
    const functionSource = firstLine.includes('return') ? firstLine : tail.slice(0, tail.search(/^\s*}\r?$/m) + tail.match(/^\s*}\r?$/m)[0].length);
    const { sandbox } = loadApi();
    vm.runInContext(functionSource, sandbox);
    assert.equal(vm.runInContext('briefError({detail: {message: "可读原因"}})', sandbox), '可读原因');
    assert.equal(vm.runInContext('briefError({unknown: "private"})', sandbox), '请求失败，请稍后重试');
  }
  for (const page of ['forgot-password', 'request-access']) {
    const source = fs.readFileSync(path.join(__dirname, '../js/' + page + '.js'), 'utf8');
    assert.match(source, /message\.textContent = API\.errorMessage\(error\)/);
  }
  for (const name of fs.readdirSync(path.join(__dirname, '../js'))) {
    const source = fs.readFileSync(path.join(__dirname, '../js/', name), 'utf8');
    assert.doesNotMatch(source, /String\(error\.message\s*\|\|\s*error\)/);
  }
});

test('上传进度失败的对象原因同样显示可读文案并隐藏结果', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/employee.js'), 'utf8');
  const start = source.indexOf('async function trackIngestProgress(');
  const end = source.indexOf('async function uploadDocument(', start);
  const { sandbox, api } = loadApi();
  api.streamTaskProgress = async () => ({ status: 'failed', error_message: { message: '转换失败' } });
  vm.runInContext(source.slice(start, end), sandbox);
  const message = { classList: { add() {}, remove() {} } };
  const box = { classList: { add() {}, remove() {} }, querySelector: () => null };
  await vm.runInContext('trackIngestProgress', sandbox)({ task_id: 'test' }, message, box);
  assert.equal(message.textContent, '入库失败：转换失败');
  assert.equal(box.innerHTML, '');
});
