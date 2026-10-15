const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const text = fs.readFileSync(path.join(__dirname, '../js/employee.js'), 'utf8');
const fn = text.slice(text.indexOf('async function trackIngestProgress('), text.indexOf('async function uploadDocument('));

test('员工上传实时显示实际排队位次，开始后恢复真实切片进度', async () => {
  const message = {textContent: '', classList: {remove() {}, add() {}}};
  const percent = {textContent: ''};
  const box = {innerHTML: '', classList: {remove() {}, add() {}}, querySelector: () => percent};
  const seen = [];
  const context = vm.createContext({API: {streamTaskProgress: async (id, update) => {
    for (const state of [{status:'pending', queue_ahead:5}, {status:'pending', queue_ahead:0},
      {status:'processing', processed_chunks:2, total_chunks:10, progress:20}]) {
      update(state); seen.push(message.textContent);
    }
    return {status:'done', doc_id:'synthetic', total_chunks:10};
  }}, escapeHtml: String, statusText: () => '待审核'});
  vm.runInContext(fn, context);
  await context.trackIngestProgress({task_id:'synthetic'}, message, box);
  assert.deepEqual(seen, ['前面还有 5 个文件在排队', '前面还有 0 个文件在排队', '正在建立索引…（2/10 片段）']);
  assert.equal(message.textContent, '文档已提交，等待审核员审核后生效');
});

test('旧后端没有位次字段时兼容，不显示虚构数字', async () => {
  const message = {textContent:'',classList:{remove(){},add(){}}};
  const box = {innerHTML:'',classList:{remove(){},add(){}},querySelector:()=>null};
  const context = vm.createContext({API:{streamTaskProgress:async (_, update)=>{
    update({status:'pending'}); assert.equal(message.textContent, '已接收，正在建立索引…');
    return {status:'done'};
  }},escapeHtml:String,statusText:()=>'-'});
  vm.runInContext(fn, context);
  await context.trackIngestProgress({task_id:'synthetic'},message,box);
});
