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
  AccountSwitcher.mount();
  document.querySelector('#logoutButton').addEventListener('click', () => AccountSwitcher.handleLogout());
  document.querySelector('#refreshRequests').addEventListener('click', loadRequests);
  document.querySelector('#refreshUsers').addEventListener('click', loadPersonnelOverview);
  document.querySelector('#refreshEnterprisePassword').addEventListener('click', () => document.querySelector('#enterprisePasswordRefreshConfirm').showModal());
  document.querySelector('#cancelEnterprisePasswordRefresh').addEventListener('click', () => document.querySelector('#enterprisePasswordRefreshConfirm').close());
  document.querySelector('#confirmEnterprisePasswordRefresh').addEventListener('click', refreshEnterprisePassword);
  document.querySelector('#refreshEmailUsage').addEventListener('click', loadEmailUsage);
  document.querySelector('#refreshMetrics').addEventListener('click', loadMetrics);
  document.querySelector('#traceIdSearch').addEventListener('click', renderTraceDetail);
  document.querySelector('#editSystemModules').addEventListener('click', () => setModuleEditing(true));
  document.querySelector('#saveSystemModules').addEventListener('click', () => document.querySelector('#systemModulesConfirm').showModal());
  document.querySelector('#cancelSystemModulesSave').addEventListener('click', closeModuleDialog);
  document.querySelector('#discardSystemModules').addEventListener('click', discardModules);
  document.querySelector('#confirmSystemModulesSave').addEventListener('click', saveModules);
  document.querySelector('#refreshOrganizations').addEventListener('click', loadOrganizations);
  document.querySelector('#createOrganizationForm').addEventListener('submit', handleCreateOrganization);
  document.querySelector('#refreshOrgMembership').addEventListener('click', loadOrgMembershipRequests);
  document.querySelector('#editLobbyContent').addEventListener('click', () => setLobbyEditing(true));
  document.querySelector('#saveLobbyContent').addEventListener('click', saveLobbyContent);
  Promise.all([loadEnterprisePassword(), loadEmailUsage(), loadPersonnelOverview(), loadOrganizations(), loadOrgMembershipRequests(), loadLobbyContent(), loadModules(), loadMetrics()]).then(loadRequests);
}

async function loadOrgMembershipRequests() {
  const table = document.querySelector('#orgMembershipTable');
  const status = document.querySelector('#orgMembershipStatus');
  table.innerHTML = `<tr><td colspan="6" class="muted">加载中...</td></tr>`;
  status.textContent = '';
  try {
    const data = await API.developerOrgMembershipRequests();
    const requests = Array.isArray(data.requests) ? data.requests : [];
    table.innerHTML = requests.length ? requests.map((item) => {
      const roleLabel = item.applicant_role === 'reviewer' ? '审核员' : '员工';
      const fallback = item.cold_start_fallback ? ' <span class="badge badge-pending">冷启动兜底</span>' : '';
      return `<tr><td>${escapeHtml(item.username || '-')}</td><td>${roleLabel}${fallback}</td><td>${escapeHtml(item.organization_name || '-')}</td><td>${item.action === 'join' ? '申请加入' : '申请退出'}</td><td>${escapeHtml(formatTimestamp(item.requested_at))}</td><td><div class="actions"><button data-id="${item.id}" data-action="approve">批准</button><button class="danger" data-id="${item.id}" data-action="reject">拒绝</button></div></td></tr>`;
    }).join('') : `<tr><td colspan="6" class="muted">暂无待处理的组织申请</td></tr>`;
    table.querySelectorAll('button[data-action]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await API.reviewOrgMembershipAsDeveloper(button.dataset.id, button.dataset.action);
        // 先刷新再写提示：loadOrgMembershipRequests() 开头会清空提示区
        await loadOrgMembershipRequests();
        status.textContent = button.dataset.action === 'approve' ? '申请已批准' : '申请已拒绝';
      } catch (error) { status.textContent = briefError(error); }
    }));
  } catch (error) { table.innerHTML = `<tr><td colspan="6" class="muted">${escapeHtml(briefError(error))}</td></tr>`; }
}

function lobbyFields() {
  return {
    tool_rules: document.querySelector('#lobbyToolRules').value,
    company_announcements: document.querySelector('#lobbyAnnouncements').value,
    industry_standards: document.querySelector('#lobbyIndustryStandards').value,
  };
}

function setLobbyEditing(editing) {
  ['#lobbyToolRules', '#lobbyAnnouncements', '#lobbyIndustryStandards'].forEach((selector) => {
    document.querySelector(selector).disabled = !editing;
  });
  document.querySelector('#editLobbyContent').classList.toggle('hidden', editing);
  document.querySelector('#saveLobbyContent').classList.toggle('hidden', !editing);
}

async function loadLobbyContent() {
  const status = document.querySelector('#lobbyContentStatus');
  try {
    const data = await API.developerLobbyContent();
    document.querySelector('#lobbyToolRules').value = data.tool_rules || '';
    document.querySelector('#lobbyAnnouncements').value = data.company_announcements || '';
    document.querySelector('#lobbyIndustryStandards').value = data.industry_standards || '';
    setLobbyEditing(false);
    status.textContent = data.updated_at ? `最近更新：${formatTimestamp(data.updated_at)}` : '尚未设置大厅内容';
  } catch (error) { status.textContent = briefError(error); }
}

async function saveLobbyContent() {
  const status = document.querySelector('#lobbyContentStatus');
  try {
    await API.saveLobbyContent(lobbyFields());
    setLobbyEditing(false);
    status.textContent = '已保存，员工与审核员大厅立即可见';
  } catch (error) { status.textContent = briefError(error); }
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

async function loadEmailUsage() {
  const value = document.querySelector('#emailUsageValue');
  const detail = document.querySelector('#emailUsageDetail');
  try {
    const data = await API.developerEmailUsage();
    value.textContent = `${Number(data.used_today || 0)} / ${Number(data.daily_limit || 0)}`;
    detail.textContent = `业务日：${data.business_day || '-'}`;
  } catch (error) {
    value.textContent = '暂无法加载';
    detail.textContent = briefError(error);
  }
}

async function refreshEnterprisePassword() {
  const dialog = document.querySelector('#enterprisePasswordRefreshConfirm');
  const button = document.querySelector('#confirmEnterprisePasswordRefresh');
  const value = document.querySelector('#enterprisePasswordValue');
  const refresh = document.querySelector('#enterprisePasswordRefresh');
  button.disabled = true;
  try {
    const data = await API.refreshEnterprisePassword();
    value.textContent = data.password || '-';
    refresh.textContent = `下次刷新：${formatTimestamp(data.next_refresh_at)}`;
    dialog.close();
  } catch (error) {
    refresh.textContent = briefError(error);
    dialog.close();
  } finally {
    button.disabled = false;
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
  const developerTable = document.querySelector('#developerPersonnelTable');
  const reviewerTable = document.querySelector('#reviewerPersonnelTable');
  const grid = document.querySelector('#headcountGrid');
  developerTable.innerHTML = rowMessage('加载中...', 6);
  reviewerTable.innerHTML = rowMessage('加载中...', 6);
  grid.innerHTML = '<p class="muted">加载中...</p>';
  try {
    const [stats, detail] = await Promise.all([API.developerHeadcountStats(), API.developerPersonnelDetail()]);
    const users = Array.isArray(detail.users) ? detail.users : [];
    const username = localStorage.getItem('username');
    currentDeveloper = users.find((item) => item.username === username && item.role === 'developer') || null;
    document.querySelector('#headcountDate').textContent = `统计日期 ${stats.snapshot_date || '-'}${stats.previous_snapshot_date ? ` · 对比 ${stats.previous_snapshot_date}` : ' · 暂无上次快照'}`;
    grid.innerHTML = [['developer','开发者'],['reviewer','审核员'],['employee','员工'],['customer','客户']].map(([role,label]) => headcountCard(label, stats.counts?.[role], stats.changes?.[role])).join('');
    const developers = users.filter((item) => item.role === 'developer');
    const reviewers = users.filter((item) => item.role === 'reviewer');
    developerTable.innerHTML = developers.length ? developers.map(personnelRow).join('') : rowMessage('暂无开发者账号', 6);
    reviewerTable.innerHTML = reviewers.length ? reviewers.map(personnelRow).join('') : rowMessage('暂无审核员账号', 6);
    bindPersonnelRowEvents(developerTable);
    bindPersonnelRowEvents(reviewerTable);
  } catch (error) {
    grid.innerHTML = `<p class="message">${escapeHtml(briefError(error))}</p>`;
    developerTable.innerHTML = rowMessage(briefError(error), 6);
    reviewerTable.innerHTML = rowMessage(briefError(error), 6);
  }
}

function bindPersonnelRowEvents(table) {
  table.querySelectorAll('.flag-button').forEach((button) => button.addEventListener('click', () => toggleFlag(button)));
  table.querySelectorAll('[data-edit-notes]').forEach((button) => button.addEventListener('click', () => beginNotesEdit(button.dataset.editNotes)));
}

function headcountCard(label, count, change) {
  const changeText = change === null || change === undefined ? '暂无对比' : `${change > 0 ? '+' : ''}${change}`;
  const changeClass = change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : '';
  return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${Number(count || 0)}</strong><small class="${changeClass}">较上次 ${escapeHtml(changeText)}</small></div>`;
}

function personnelRow(item) {
  const notes = item.notes || '';
  return `<tr><td>${escapeHtml(item.username || '-')}</td><td><span class="status-badge ${item.is_active ? 'status-verified' : 'status-pending'}">${item.is_active ? '启用' : '禁用'}</span></td><td>${item.is_default_account ? '是' : '否'}</td><td>${escapeHtml(formatTimestamp(item.last_login_at))}</td><td><button class="flag-button ${item.flagged ? 'is-flagged' : ''}" data-user="${item.user_id}" data-flagged="${Boolean(item.flagged)}" title="切换特别关注" aria-label="切换特别关注">${item.flagged ? '★' : '☆'}</button></td><td class="notes-cell" data-user-notes="${item.user_id}" data-notes-value="${escapeHtml(notes)}">${notesViewMarkup(item.user_id, notes)}</td></tr>`;
}

function notesViewMarkup(userId, notes) {
  return `<div class="notes-view"><span class="notes-text">${escapeHtml(notes || '暂无备注')}</span><button class="secondary" data-edit-notes="${userId}">编辑</button></div>`;
}

async function toggleFlag(button) {
  const status = document.querySelector('#usersStatus');
  try {
    await API.setPersonnelFlag(button.dataset.user, button.dataset.flagged !== 'true');
    status.textContent = '特别关注状态已更新';
    await loadPersonnelOverview();
  } catch (error) { status.textContent = briefError(error); }
}

function beginNotesEdit(userId) {
  const cell = document.querySelector(`.notes-cell[data-user-notes="${userId}"]`);
  if (!cell) return;
  const currentValue = cell.dataset.notesValue || '';
  cell.innerHTML = `<div class="notes-edit"><input class="notes-edit-input" value="${escapeHtml(currentValue)}" maxlength="500" placeholder="添加内部备注" /><button data-save-notes="${userId}">保存</button></div>`;
  cell.querySelector('[data-save-notes]').addEventListener('click', () => saveNotes(userId, cell));
  cell.querySelector('.notes-edit-input').focus();
}

async function saveNotes(userId, cell) {
  const input = cell.querySelector('.notes-edit-input');
  const saveButton = cell.querySelector('[data-save-notes]');
  const newValue = input.value;
  const status = document.querySelector('#usersStatus');
  saveButton.disabled = true;
  try {
    await API.savePersonnelNotes(userId, newValue);
    cell.dataset.notesValue = newValue;
    cell.innerHTML = notesViewMarkup(userId, newValue);
    cell.querySelector('[data-edit-notes]').addEventListener('click', () => beginNotesEdit(userId));
    status.textContent = '备注已保存';
  } catch (error) {
    status.textContent = briefError(error);
    saveButton.disabled = false;
  }
}

function moduleValues() { return { tone: toneModule.value, forbidden: forbiddenModule.value }; }
function setModuleEditing(editing) { [toneModule,forbiddenModule].forEach((item) => { item.disabled = !editing; }); editSystemModules.classList.toggle('hidden', editing); saveSystemModules.classList.toggle('hidden', !editing); }
async function loadModules() { try { const data = await API.systemModules(); guidanceModule.value=data.guidance?.content||''; toneModule.value=data.tone?.content||''; forbiddenModule.value=data.forbidden?.content||''; window.savedModules=moduleValues(); setModuleEditing(false); systemModulesStatus.textContent='模块已加载'; } catch(error) { systemModulesStatus.textContent=briefError(error); } }
function closeModuleDialog() { systemModulesConfirm.close(); }
function discardModules() { const values=window.savedModules||{tone:'',forbidden:''}; toneModule.value=values.tone; forbiddenModule.value=values.forbidden; closeModuleDialog(); setModuleEditing(false); systemModulesStatus.textContent='已放弃本次修改'; }
async function saveModules() { try { const values=moduleValues(); await API.saveSystemModules(values); window.savedModules=values; closeModuleDialog(); setModuleEditing(false); systemModulesStatus.textContent='已保存，将从下一次请求生效'; } catch(error) { systemModulesStatus.textContent=briefError(error); } }

async function loadOrganizations() {
  const table = document.querySelector('#organizationsTable');
  table.innerHTML = rowMessage('加载中...', 4);
  try {
    const data = await API.listOrganizations();
    const items = Array.isArray(data.organizations) ? data.organizations : [];
    table.innerHTML = items.length ? items.map(organizationRow).join('') : rowMessage('暂无组织', 4);
    table.querySelectorAll('[data-edit-org]').forEach((button) => button.addEventListener('click', () => beginOrganizationEdit(button.dataset.editOrg)));
    table.querySelectorAll('[data-delete-org]').forEach((button) => {
      const row = button.closest('tr');
      button.addEventListener('click', () => deleteOrganizationHandler(button.dataset.deleteOrg, row.dataset.orgName));
    });
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 4);
  }
}

function organizationRow(item) {
  const actions = item.is_protected
    ? '<span class="muted">默认组织不可修改</span>'
    : `<div class="actions"><button class="secondary" data-edit-org="${item.id}">编辑</button><button class="danger" data-delete-org="${item.id}">删除</button></div>`;
  return `<tr data-org-id="${item.id}" data-org-name="${escapeHtml(item.name)}" data-org-content="${escapeHtml(item.content || '')}"><td class="org-name-cell">${escapeHtml(item.name)}${item.is_protected ? ' <span class="badge">受保护</span>' : ''}</td><td class="org-content-cell">${escapeHtml(item.content || '-')}</td><td>${Number(item.member_count || 0)}</td><td class="org-actions-cell">${actions}</td></tr>`;
}

function beginOrganizationEdit(id) {
  const row = document.querySelector(`tr[data-org-id="${id}"]`);
  if (!row) return;
  const name = row.dataset.orgName;
  const content = row.dataset.orgContent;
  row.querySelector('.org-name-cell').innerHTML = `<input class="org-edit-name" value="${escapeHtml(name)}" maxlength="50" />`;
  row.querySelector('.org-content-cell').innerHTML = `<input class="org-edit-content" value="${escapeHtml(content)}" maxlength="200" />`;
  row.querySelector('.org-actions-cell').innerHTML = `<div class="actions"><button data-save-org="${id}">保存</button><button class="secondary" data-cancel-org="${id}">取消</button></div>`;
  row.querySelector('[data-save-org]').addEventListener('click', () => saveOrganizationEdit(id, row));
  row.querySelector('[data-cancel-org]').addEventListener('click', loadOrganizations);
}

async function saveOrganizationEdit(id, row) {
  const name = row.querySelector('.org-edit-name').value.trim();
  const content = row.querySelector('.org-edit-content').value.trim();
  const status = document.querySelector('#organizationsStatus');
  try {
    await API.updateOrganization(id, { name, content: content || null });
    status.textContent = '组织已更新';
    await Promise.all([loadOrganizations(), loadModules()]);
  } catch (error) {
    status.textContent = briefError(error);
  }
}

async function deleteOrganizationHandler(id, name) {
  if (!confirm(`确认删除组织"${name}"？相关账号的组织关联将被清除，账号本身不受影响。`)) return;
  const status = document.querySelector('#organizationsStatus');
  try {
    await API.deleteOrganization(id);
    status.textContent = '组织已删除';
    await Promise.all([loadOrganizations(), loadModules()]);
  } catch (error) {
    status.textContent = briefError(error);
  }
}

async function handleCreateOrganization(event) {
  event.preventDefault();
  const nameInput = document.querySelector('#newOrganizationName');
  const contentInput = document.querySelector('#newOrganizationContent');
  const status = document.querySelector('#organizationsStatus');
  const name = nameInput.value.trim();
  const content = contentInput.value.trim();
  if (!name) return;
  try {
    await API.createOrganization(name, content || null);
    nameInput.value = '';
    contentInput.value = '';
    status.textContent = '组织已创建';
    await Promise.all([loadOrganizations(), loadModules()]);
  } catch (error) {
    status.textContent = briefError(error);
  }
}

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
function renderTrend(records) {
  const recent = records.slice(-30);
  const values = recent.map((item) => Number(item.total_elapsed_ms || 0));
  const maximum = Math.max(...values, 1);
  const points = values.map((value, index) => `${24 + (672 * index / Math.max(values.length - 1, 1))},${156 - (132 * value / maximum)}`);
  requestTrendChart.innerHTML = recent.length ? `<polyline class="trend-line" points="${points.join(' ')}" />` : '';
  requestTrendTable.innerHTML = recent.length ? recent.slice().reverse().map((item) => `<tr><td>${escapeHtml(formatTimestamp(item.timestamp))}</td><td>${traceIdCell(item.trace_id)}</td><td>${escapeHtml(item.mode||'-')}</td><td>${Number(item.total_elapsed_ms||0)}ms</td><td>${escapeHtml(item.status||'-')}</td></tr>`).join('') : rowMessage('暂无趋势数据', 5);
  requestTrendTable.querySelectorAll('.trace-copy').forEach((button) => button.addEventListener('click', () => copyTraceId(button)));
}

function traceIdCell(traceId) {
  const value = traceId || '';
  if (!value) return '<span class="muted">-</span>';
  return `<button class="trace-copy" type="button" data-trace-id="${escapeHtml(value)}" title="点击复制trace_id">${escapeHtml(value)}</button>`;
}

async function copyTraceId(button) {
  const value = button.dataset.traceId;
  if (!value) return;
  const original = value;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    button.textContent = '已复制';
    button.disabled = true;
    setTimeout(() => { button.textContent = original; button.disabled = false; }, 1200);
  } catch (error) {
    button.textContent = '复制失败';
    setTimeout(() => { button.textContent = original; }, 1200);
  }
}
function rowMessage(text,colspan){return `<tr><td colspan="${colspan}" class="muted">${escapeHtml(text)}</td></tr>`;}
function briefError(error){return String(error.message||error).replaceAll('\n',' ').slice(0,120);}
function formatTimestamp(value){if(!value)return '-';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString();}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
