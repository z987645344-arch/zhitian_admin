if (API.ensureRole(['developer'])) initDeveloperPage();

let currentDeveloper = null;
const guidanceModule = document.querySelector('#guidanceModule');
const toneModule = document.querySelector('#toneModule');
const forbiddenModule = document.querySelector('#forbiddenModule');
const editSystemModules = document.querySelector('#editSystemModules');
const saveSystemModules = document.querySelector('#saveSystemModules');
const systemModulesStatus = document.querySelector('#systemModulesStatus');
const systemModulesConfirm = document.querySelector('#systemModulesConfirm');
const metricsGrid = document.querySelector('#metricsGrid');
const metricsTimestamp = document.querySelector('#metricsTimestamp');
const stageTimingTable = document.querySelector('#stageTimingTable');
const traceIdQuery = document.querySelector('#traceIdQuery');
const traceDetail = document.querySelector('#traceDetail');
const requestTrendChart = document.querySelector('#requestTrendChart');
const requestTrendTable = document.querySelector('#requestTrendTable');

function initDeveloperPage() {
  document.querySelector('#currentUser').textContent = localStorage.getItem('username') || '-';
  document.querySelector('#logoutButton').addEventListener('click', () => { API.logout(); location.replace('./login.html'); });
  document.querySelector('#refreshRequests').addEventListener('click', loadRequests);
  document.querySelector('#refreshUsers').addEventListener('click', loadPersonnelOverview);
  document.querySelector('#refreshPasswordResets').addEventListener('click', loadPasswordResetEvents);
  document.querySelector('#refreshMetrics').addEventListener('click', loadMetrics);
  document.querySelector('#traceIdSearch').addEventListener('click', renderTraceDetail);
  document.querySelector('#editSystemModules').addEventListener('click', () => setModuleEditing(true));
  document.querySelector('#saveSystemModules').addEventListener('click', () => document.querySelector('#systemModulesConfirm').showModal());
  document.querySelector('#cancelSystemModulesSave').addEventListener('click', closeModuleDialog);
  document.querySelector('#discardSystemModules').addEventListener('click', discardModules);
  document.querySelector('#confirmSystemModulesSave').addEventListener('click', saveModules);
  Promise.all([loadEnterprisePassword(), loadPersonnelOverview(), loadPasswordResetEvents(), loadModules(), loadMetrics()]).then(loadRequests);
}

async function loadEnterprisePassword() {
  const value = document.querySelector('#enterprisePasswordValue');
  const refresh = document.querySelector('#enterprisePasswordRefresh');
  try {
    const data = await API.developerEnterprisePassword();
    value.textContent = data.password || '-';
    refresh.textContent = `下次刷新：${formatTimestamp(data.next_refresh_at)}`;
  } catch (error) {
    value.textContent = '暂无法加载';
    refresh.textContent = briefError(error);
  }
}

async function loadRequests() {
  const developerTable = document.querySelector('#developerRequestsTable');
  const reviewerTable = document.querySelector('#reviewerRequestsTable');
  const status = document.querySelector('#requestStatus');
  developerTable.innerHTML = rowMessage('加载中...', 3);
  reviewerTable.innerHTML = rowMessage('加载中...', 3);
  status.textContent = '';
  try {
    const data = await API.developerRegistrationRequests();
    const requests = Array.isArray(data.requests) ? data.requests : [];
    renderRequestTable(developerTable, requests.filter((item) => item.requested_role === 'developer'), false);
    renderRequestTable(reviewerTable, requests.filter((item) => item.requested_role === 'reviewer'), Boolean(currentDeveloper?.is_default_account));
  } catch (error) {
    developerTable.innerHTML = rowMessage(briefError(error), 3);
    reviewerTable.innerHTML = rowMessage(briefError(error), 3);
  }
}

function renderRequestTable(table, requests, blockApproval) {
  table.innerHTML = requests.length ? requests.map((item) => {
      const blocked = Boolean(currentDeveloper?.is_default_account && item.requested_role === 'reviewer');
      return `<tr><td>${escapeHtml(item.username || item.email || '-')}</td><td>${escapeHtml(formatTimestamp(item.created_at))}</td><td><div class="actions"><button data-id="${item.id}" data-action="approve" ${blocked || blockApproval ? 'disabled title="默认开发者账号仅可审批开发者加入申请"' : ''}>批准</button><button class="danger" data-id="${item.id}" data-action="reject">拒绝</button></div>${blocked || blockApproval ? '<small class="muted">默认开发者账号仅可审批开发者加入申请</small>' : ''}</td></tr>`;
    }).join('') : rowMessage('暂无待审批申请', 3);
  table.querySelectorAll('button[data-action]:not(:disabled)').forEach((button) => button.addEventListener('click', async () => {
    const status = document.querySelector('#requestStatus');
    try {
      await API.reviewDeveloperRegistration(button.dataset.id, button.dataset.action);
      status.textContent = button.dataset.action === 'approve' ? '申请已批准' : '申请已拒绝';
      await Promise.all([loadRequests(), loadPersonnelOverview()]);
    } catch (error) { status.textContent = briefError(error); }
  }));
}

async function loadPersonnelOverview() {
  const table = document.querySelector('#personnelTable');
  const grid = document.querySelector('#headcountGrid');
  table.innerHTML = rowMessage('加载中...', 7);
  grid.innerHTML = '<p class="muted">加载中...</p>';
  try {
    const [stats, detail] = await Promise.all([API.developerHeadcountStats(), API.developerPersonnelDetail()]);
    const users = Array.isArray(detail.users) ? detail.users : [];
    const username = localStorage.getItem('username');
    currentDeveloper = users.find((item) => item.username === username && item.role === 'developer') || null;
    document.querySelector('#headcountDate').textContent = `统计日期 ${stats.snapshot_date || '-'}${stats.previous_snapshot_date ? ` · 对比 ${stats.previous_snapshot_date}` : ' · 暂无上次快照'}`;
    grid.innerHTML = [['developer','开发者'],['reviewer','审核员'],['employee','员工'],['customer','客户']].map(([role,label]) => headcountCard(label, stats.counts?.[role], stats.changes?.[role])).join('');
    table.innerHTML = users.length ? users.map(personnelRow).join('') : rowMessage('暂无开发者或审核员账号', 7);
    table.querySelectorAll('.flag-button').forEach((button) => button.addEventListener('click', () => toggleFlag(button)));
    table.querySelectorAll('[data-save-notes]').forEach((button) => button.addEventListener('click', () => saveNotes(button.dataset.saveNotes)));
  } catch (error) {
    grid.innerHTML = `<p class="message">${escapeHtml(briefError(error))}</p>`;
    table.innerHTML = rowMessage(briefError(error), 7);
  }
}

function headcountCard(label, count, change) {
  const changeText = change === null || change === undefined ? '暂无对比' : `${change > 0 ? '+' : ''}${change}`;
  const changeClass = change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : '';
  return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${Number(count || 0)}</strong><small class="${changeClass}">较上次 ${escapeHtml(changeText)}</small></div>`;
}

function personnelRow(item) {
  return `<tr><td>${escapeHtml(item.username || '-')}</td><td>${escapeHtml(item.role || '-')}</td><td><span class="status-badge ${item.is_active ? 'status-verified' : 'status-pending'}">${item.is_active ? '启用' : '禁用'}</span></td><td>${item.is_default_account ? '是' : '否'}</td><td>${escapeHtml(formatTimestamp(item.last_login_at))}</td><td><button class="flag-button ${item.flagged ? 'is-flagged' : ''}" data-user="${item.user_id}" data-flagged="${Boolean(item.flagged)}" title="切换特别关注" aria-label="切换特别关注">${item.flagged ? '★' : '☆'}</button></td><td><div class="notes-control"><input data-notes-for="${item.user_id}" value="${escapeHtml(item.notes || '')}" maxlength="500" placeholder="添加内部备注" /><button class="secondary" data-save-notes="${item.user_id}">保存</button></div></td></tr>`;
}

async function toggleFlag(button) {
  const status = document.querySelector('#usersStatus');
  try {
    await API.setPersonnelFlag(button.dataset.user, button.dataset.flagged !== 'true');
    status.textContent = '特别关注状态已更新';
    await loadPersonnelOverview();
  } catch (error) { status.textContent = briefError(error); }
}

async function saveNotes(userId) {
  const status = document.querySelector('#usersStatus');
  try {
    await API.savePersonnelNotes(userId, document.querySelector(`[data-notes-for="${userId}"]`).value);
    status.textContent = '备注已保存';
  } catch (error) { status.textContent = briefError(error); }
}

async function loadPasswordResetEvents() {
  const table = document.querySelector('#passwordResetTable');
  table.innerHTML = rowMessage('加载中...', 2);
  try {
    const data = await API.developerPasswordResetEvents();
    const events = Array.isArray(data.events) ? data.events : [];
    table.innerHTML = events.length ? events.map((item) => `<tr><td>${escapeHtml(item.username || '-')}</td><td>${escapeHtml(formatTimestamp(item.created_at))}</td></tr>`).join('') : rowMessage('暂无密码重置记录', 2);
  } catch (error) { table.innerHTML = rowMessage(briefError(error), 2); }
}

function moduleValues() { return { guidance: guidanceModule.value, tone: toneModule.value, forbidden: forbiddenModule.value }; }
function setModuleEditing(editing) { [guidanceModule,toneModule,forbiddenModule].forEach((item) => { item.disabled = !editing; }); editSystemModules.classList.toggle('hidden', editing); saveSystemModules.classList.toggle('hidden', !editing); }
async function loadModules() { try { const data = await API.systemModules(); guidanceModule.value=data.guidance?.content||''; toneModule.value=data.tone?.content||''; forbiddenModule.value=data.forbidden?.content||''; window.savedModules=moduleValues(); setModuleEditing(false); systemModulesStatus.textContent='模块已加载'; } catch(error) { systemModulesStatus.textContent=briefError(error); } }
function closeModuleDialog() { systemModulesConfirm.close(); }
function discardModules() { const values=window.savedModules||{guidance:'',tone:'',forbidden:''}; guidanceModule.value=values.guidance; toneModule.value=values.tone; forbiddenModule.value=values.forbidden; closeModuleDialog(); setModuleEditing(false); systemModulesStatus.textContent='已放弃本次修改'; }
async function saveModules() { try { const values=moduleValues(); await API.saveSystemModules(values); window.savedModules=values; closeModuleDialog(); setModuleEditing(false); systemModulesStatus.textContent='已保存，将从下一次请求生效'; } catch(error) { systemModulesStatus.textContent=briefError(error); } }

async function loadMetrics() {
  metricsGrid.innerHTML='<p class="muted">加载中...</p>';
  try {
    const data=await API.reviewerMetrics(); window.latestMetrics=data; metricsTimestamp.textContent=`数据截至 ${formatTimestamp(data.stats_since)}`;
    const requests=data.requests||{}, calls=data.model_calls||{}, errors=data.provider_errors?.deepseek||{};
    const cards=[['请求总数',requests.total],['成功',requests.success],['降级',requests.degraded],['错误',requests.error],['快速调用',`${calls.fast?.calls||0} / ${calls.fast?.average_elapsed_ms||0}ms`],['专家调用',`${calls.expert?.calls||0} / ${calls.expert?.average_elapsed_ms||0}ms`],['搜索降级',data.search_fallback_count],['输出校验',data.output_anomaly_check_total],['输出异常',data.output_anomaly_flagged_total],['输出校验失败',data.output_anomaly_check_failed_total],['DeepSeek错误',`超时 ${errors.timeout||0} / 限流 ${errors.rate_limit||0} / 其他 ${errors.other||0}`]];
    metricsGrid.innerHTML=cards.map(([label,value])=>`<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value??0)}</strong></div>`).join('');
    renderStageTimings(data.recent_requests||[]); renderTrend(data.recent_requests||[]); renderTraceDetail();
  } catch(error) { metricsGrid.innerHTML=`<p class="message">${escapeHtml(briefError(error))}</p>`; }
}
function renderStageTimings(records) { const stages={}; records.forEach((record)=>Object.entries(record.stage_timings||{}).forEach(([name,time])=>{const item=stages[name]||{total:0,count:0};item.total+=Number(time||0);item.count++;stages[name]=item;})); const rows=Object.entries(stages); stageTimingTable.innerHTML=rows.length?rows.map(([name,item])=>`<tr><td>${escapeHtml(name)}</td><td>${Math.round(item.total/item.count)}ms</td><td>${item.count}</td></tr>`).join(''):rowMessage('暂无阶段数据',3); }
function renderTraceDetail() { const id=traceIdQuery.value.trim(); if(!id){traceDetail.classList.add('hidden');return;} const record=(window.latestMetrics?.recent_requests||[]).find((item)=>item.trace_id===id); traceDetail.classList.remove('hidden'); traceDetail.textContent=record?`模式：${record.mode}；状态：${record.status}；总耗时：${record.total_elapsed_ms}ms；阶段：${JSON.stringify(record.stage_timings||{})}`:'未找到该 trace_id。'; }
function renderTrend(records) { const recent=records.slice(-30), values=recent.map((item)=>Number(item.total_elapsed_ms||0)), maximum=Math.max(...values,1), points=values.map((value,index)=>`${24+(672*index/Math.max(values.length-1,1))},${156-(132*value/maximum)}`); requestTrendChart.innerHTML=recent.length?`<polyline class="trend-line" points="${points.join(' ')}" />`:''; requestTrendTable.innerHTML=recent.length?recent.slice().reverse().map((item)=>`<tr><td>${escapeHtml(formatTimestamp(item.timestamp))}</td><td>${escapeHtml(item.mode||'-')}</td><td>${Number(item.total_elapsed_ms||0)}ms</td><td>${escapeHtml(item.status||'-')}</td></tr>`).join(''):rowMessage('暂无趋势数据',4); }
function rowMessage(text,colspan){return `<tr><td colspan="${colspan}" class="muted">${escapeHtml(text)}</td></tr>`;}
function briefError(error){return String(error.message||error).replaceAll('\n',' ').slice(0,120);}
function formatTimestamp(value){if(!value)return '-';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString();}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
