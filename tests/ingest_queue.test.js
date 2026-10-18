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
  assert.deepEqual(seen, ['前面还有 5 个文件在排队', '即将开始，等待处理位', '正在建立索引…（2/10 片段）']);
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

test('排队位次为零时明确显示等待处理位，而非还有零个文件', async () => {
  const message = {textContent:'',classList:{remove(){},add(){}}};
  const box = {innerHTML:'',classList:{remove(){},add(){}},querySelector:()=>null};
  const context = vm.createContext({API:{streamTaskProgress:async (_, update)=>{
    update({status:'pending', queue_ahead:0});
    assert.equal(message.textContent, '即将开始，等待处理位');
    return {status:'done'};
  }},escapeHtml:String,statusText:()=>'-'});
  vm.runInContext(fn, context);
  await context.trackIngestProgress({task_id:'synthetic'},message,box);
});

test('接收排队到解析再入库使用同一进度，不显示虚构百分比', async () => {
  const message = {textContent:'',classList:{remove(){},add(){}}};
  const percent = {textContent:''};
  const box = {innerHTML:'',classList:{remove(){},add(){}},querySelector:()=>percent};
  const seen = [];
  const context = vm.createContext({API:{streamTaskProgress:async (_, update)=>{
    assert.equal(message.textContent, '前面还有 3 个文件在排队');
    for (const state of [
      {status:'pending',queue_ahead:0,file_progress:{stage:'queued',total:null}},
      {status:'processing',file_progress:{stage:'preparing',total:null}},
      {status:'processing',file_progress:{stage:'converting',total:null}},
      {status:'pending',queue_ahead:2,file_progress:{stage:'queued',total:10}},
      {status:'processing',processed_chunks:4,total_chunks:10,progress:40,file_progress:{stage:'ingesting'}},
    ]) { update(state); seen.push([message.textContent,percent.textContent]); }
    return {status:'done',total_chunks:10};
  }},escapeHtml:String,statusText:()=>'-'});
  vm.runInContext(fn, context);
  await context.trackIngestProgress({task_id:'synthetic',queue_ahead:3},message,box);
  assert.deepEqual(seen, [
    ['即将开始，等待处理位','等待中'], ['正在解析文档…','处理中'],
    ['正在转换文档…','处理中'], ['前面还有 2 个文件在排队','等待中'],
    ['正在建立索引…（4/10 片段）','40%'],
  ]);
});

test('排队解析失败显示后端的原始可读原因', async () => {
  const message = {textContent:'',classList:{remove(){},add(){}}};
  const box = {innerHTML:'',classList:{remove(){},add(){}},querySelector:()=>null};
  const reason = '文件大小未超过50MB，但文档内容过多（2001个片段，上限2000个）。为控制处理时间，请拆分后再上传';
  const context = vm.createContext({API:{streamTaskProgress:async()=>({status:'failed',error_message:reason}),errorMessage:String},escapeHtml:String});
  vm.runInContext(fn, context);
  await context.trackIngestProgress({task_id:'synthetic',queue_ahead:0},message,box);
  assert.equal(message.textContent, '入库失败：' + reason);
  assert.equal(box.innerHTML, '');
});
