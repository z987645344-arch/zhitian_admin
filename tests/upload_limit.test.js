const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/employee.js'),'utf8');
const start=source.indexOf('async function loadUploadLimit()'),end=source.indexOf('// F36异步化',start);
function context(fetch){
  const elements={'#documentFile':{files:[]},'#uploadLimitLabel':{textContent:''},'#uploadMessage':{textContent:'',classList:{remove(){}}}};
  return {elements,vm:vm.createContext({API:{fileEngines:fetch},document:{querySelector:id=>elements[id]},
    briefError:e=>e.message,maxUploadMB:5,uploadLimitNotice:''})};
}
test('读取后端同源max_upload_size_mb，49MiB不被旧5MiB拦截，超过50MiB明确拒绝',async()=>{
  const c=context(async()=>({max_upload_size_mb:50}));
  vm.runInContext(source.slice(start,end),c.vm);
  await vm.runInContext('loadUploadLimit()',c.vm);
  assert.equal(c.vm.maxUploadMB,50);
  assert.equal(c.elements['#uploadLimitLabel'].textContent,'单个文件不超过50MB');
  c.elements['#documentFile'].files=[{name:'sample.pdf',size:49*1024*1024}];
  vm.runInContext('showConversionHint({target:document.querySelector("#documentFile")})',c.vm);
  assert.doesNotMatch(c.elements['#uploadMessage'].textContent,/超出/);
  c.elements['#documentFile'].files[0].size=51*1024*1024;
  vm.runInContext('showConversionHint({target:document.querySelector("#documentFile")})',c.vm);
  assert.match(c.elements['#uploadMessage'].textContent,/超出 50MB/);
});
test('读取失败和无效配置保守退回5MiB并提示原因',async()=>{
  for(const fetch of [async()=>{throw new Error('服务暂时不可达');},async()=>({max_upload_size_mb:0})]){
    const c=context(fetch);vm.runInContext(source.slice(start,end),c.vm);
    await vm.runInContext('loadUploadLimit()',c.vm);
    assert.equal(c.vm.maxUploadMB,5);
    assert.match(c.elements['#uploadLimitLabel'].textContent,/5MB.*保守限制/);
    assert.match(c.elements['#uploadMessage'].textContent,/无法读取.*暂按5MB/);
  }
});
test('上传前再刷新配置，HTML413不会抛JSON解析错误',async()=>{
  assert.match(source,/await loadUploadLimit\(\);\s*if \(file.size > maxUploadMB/);
  const c=vm.createContext({window:{},localStorage:{getItem:()=>''},
    fetch:async()=>({status:413,ok:false,text:async()=>'<html>too large</html>'})});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/api.js'),'utf8'),c);
  await assert.rejects(vm.runInContext('API.fileEngines()',c),/文件过大/);
});
