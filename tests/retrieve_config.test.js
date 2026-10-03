const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/reviewer.js'), 'utf8');
const start = source.indexOf('async function loadDebugRetrieveConfig()');
const end = source.indexOf('async function runDebugRetrieve()', start);
test('默认值来自后端，修改后端配置即可改变输入和说明，不硬编码8', async () => {
  for (const n of [6, 8, 10]) {
    const elements = { '#debugTopK': { value: '' }, '#runDebugRetrieve': { disabled: false }, '#debugDefaultDescription': { textContent: '' } };
    const context = vm.createContext({ API: { debugRetrieveConfig: async () => ({ document_top_k: n }) }, document: { querySelector: id => elements[id] }, briefError: e => e.message });
    vm.runInContext(source.slice(start, end), context);
    await vm.runInContext('loadDebugRetrieveConfig()', context);
    assert.equal(elements['#debugTopK'].value, String(n));
    assert.match(elements['#debugDefaultDescription'].textContent, new RegExp('聊天时最多取前 ' + n + ' 个过线资料'));
    assert.equal(elements['#runDebugRetrieve'].disabled, false);
  }
});
test('读取失败时明确提示且不悄悄使用写死默认值', async () => {
  const elements = { '#debugTopK': { value: '' }, '#runDebugRetrieve': {}, '#debugDefaultDescription': {} };
  const context = vm.createContext({ API: { debugRetrieveConfig: async () => { throw new Error('不可达'); } }, document: { querySelector: id => elements[id] }, briefError: e => e.message });
  vm.runInContext(source.slice(start, end), context);
  await vm.runInContext('loadDebugRetrieveConfig()', context);
  assert.equal(elements['#debugTopK'].value, '');
  assert.equal(elements['#runDebugRetrieve'].disabled, true);
  assert.match(elements['#debugDefaultDescription'].textContent, /加载失败.*不可达/);
});
