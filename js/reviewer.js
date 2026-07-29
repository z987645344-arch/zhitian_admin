if (API.ensureRole(['reviewer'])) {
  initReviewerPage();
}

let reviewerJoinedOrganizations = [];
let selectedReviewerOrganization = null;

function initReviewerPage() {
  document.querySelector('#currentUser').textContent = `当前账号：${localStorage.getItem('username') || '-'}`;
  AccountSwitcher.mount();
  document.querySelector('#logoutButton').addEventListener('click', () => AccountSwitcher.handleLogout());
  document.querySelector('#refreshPending').addEventListener('click', loadPending);
  document.querySelector('#refreshDocuments').addEventListener('click', loadDocuments);
  document.querySelector('#refreshJoinedOrganizations').addEventListener('click', loadJoinedOrganizations);
  document.querySelector('#backToReviewerOrganizations').addEventListener('click', showReviewerOrganizationList);
  document.querySelector('#refreshStats').addEventListener('click', loadStats);
  document.querySelector('#refreshEmployeeRequests').addEventListener('click', loadEmployeeRequests);
  document.querySelector('#runDebugRetrieve').addEventListener('click', runDebugRetrieve);
  document.querySelector('#debugQuery').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runDebugRetrieve();
  });
  document.querySelector('#refreshOrgRequests').addEventListener('click', loadOrgRequests);
  document.querySelector('#refreshLobby').addEventListener('click', loadLobby);
  document.querySelector('#toggleEnterprisePassword').addEventListener('click', toggleEnterprisePassword);
  loadStats();
  loadEmployeeRequests();
  loadEnterprisePassword();
  loadOrgRequests();
  loadLobby();
}

function toggleEnterprisePassword(event) {
  const value = document.querySelector('#enterprisePasswordValue');
  const concealed = value.classList.toggle('is-concealed');
  event.currentTarget.textContent = concealed ? '显示密码' : '隐藏密码';
  event.currentTarget.setAttribute('aria-pressed', String(!concealed));
}

// 组织卡片由目录、verified统计和当前审核范围内的pending列表合并生成。
// pending只用于本地计数；进入详情后仍调用带organization_id的后端接口。
async function loadJoinedOrganizations() {
  const box = document.querySelector('#reviewerJoinedOrganizations');
  box.innerHTML = '<p class="muted">组织加载中...</p>';
  try {
    const [directoryData, verifiedData, pendingData] = await Promise.all([
      API.organizationsDirectory(),
      API.reviewerDocumentsByOrganization(),
      API.pendingDocuments(),
    ]);
    const directory = Array.isArray(directoryData.organizations)
      ? directoryData.organizations.filter((item) => item.my_status === 'joined')
      : [];
    const verifiedCounts = new Map(
      (verifiedData.organizations || []).map((item) => [
        Number(item.organization_id),
        Number(item.document_count || 0),
      ]),
    );
    const pendingCounts = new Map();
    (pendingData.documents || []).forEach((item) => {
      const id = Number(item.organization_id);
      pendingCounts.set(id, (pendingCounts.get(id) || 0) + 1);
    });
    reviewerJoinedOrganizations = directory.map((item) => ({
      ...item,
      pending_count: pendingCounts.get(Number(item.id)) || 0,
      verified_count: verifiedCounts.get(Number(item.id)) || 0,
    }));
    renderReviewerOrganizations();
    if (
      selectedReviewerOrganization
      && !reviewerJoinedOrganizations.some(
        (item) => Number(item.id) === Number(selectedReviewerOrganization.id),
      )
    ) {
      showReviewerOrganizationList();
    }
  } catch (error) {
    box.innerHTML = `<p class="muted">组织加载失败：${escapeHtml(briefError(error))}</p>`;
  }
}

function renderReviewerOrganizations() {
  const box = document.querySelector('#reviewerJoinedOrganizations');
  box.innerHTML = reviewerJoinedOrganizations.length
    ? reviewerJoinedOrganizations.map((item) => `
        <article class="organization-work-card">
          <div><h3>${escapeHtml(item.name || '未命名组织')}</h3><p>${item.content ? escapeHtml(item.content) : '暂无组织简介'}</p></div>
          <div class="organization-work-counts">
            <span>待审核<strong>${Number(item.pending_count || 0)}</strong></span>
            <span>已通过<strong>${Number(item.verified_count || 0)}</strong></span>
          </div>
          <button type="button" data-open-reviewer-org="${Number(item.id)}">进入组织</button>
        </article>
      `).join('')
    : '<p class="muted">尚未加入任何组织，请先在组织大厅申请加入。</p>';
  box.querySelectorAll('button[data-open-reviewer-org]').forEach((button) => {
    button.addEventListener('click', () => openReviewerOrganization(button.dataset.openReviewerOrg));
  });
}

async function openReviewerOrganization(organizationId) {
  const organization = reviewerJoinedOrganizations.find(
    (item) => Number(item.id) === Number(organizationId),
  );
  if (!organization) return;
  selectedReviewerOrganization = organization;
  document.querySelector('#reviewerOrganizationTitle').textContent = organization.name || '组织详情';
  document.querySelector('#reviewerOrganizationSummary').textContent = organization.content || '暂无组织简介';
  document.querySelector('#reviewerOrganizationListView').classList.add('hidden');
  document.querySelector('#reviewerOrganizationDetail').classList.remove('hidden');
  await Promise.all([loadPending(), loadDocuments()]);
}

function showReviewerOrganizationList() {
  selectedReviewerOrganization = null;
  document.querySelector('#reviewerOrganizationDetail').classList.add('hidden');
  document.querySelector('#reviewerOrganizationListView').classList.remove('hidden');
  ['#previewPanel', '#documentPreviewPanel'].forEach((selector) => {
    const panel = document.querySelector(selector);
    panel.classList.add('hidden');
    panel.innerHTML = '';
  });
}

function loadLobby() {
  return OrgLobby.load({
    lobbySelector: '#lobbyContent',
    directorySelector: '#organizationDirectory',
    messageSelector: '#lobbyMessage',
    onChange: applyWorkGate,
  });
}

// 未加入任何自定义组织时禁用文档审核入口；员工账号审批不受此门槛限制，
// 那是账号是否存在的审批，与加入工作组织是两条独立链路。
function applyWorkGate(joinedOrganizations) {
  const hasOrganization = Array.isArray(joinedOrganizations) && joinedOrganizations.length > 0;
  const notice = document.querySelector('#workGateNotice');
  notice.textContent = hasOrganization ? '' : '你尚未加入任何组织。请先在组织大厅申请加入（员工账号审批不受影响）。';
  notice.classList.toggle('hidden', hasOrganization);
  loadJoinedOrganizations();
}

async function loadOrgRequests() {
  const table = document.querySelector('#orgRequestsTable');
  const status = document.querySelector('#orgRequestStatus');
  table.innerHTML = rowMessage('加载中...', 5);
  status.textContent = '';
  try {
    const data = await API.reviewerOrgMembershipRequests();
    const requests = Array.isArray(data.requests) ? data.requests : [];
    table.innerHTML = requests.length ? requests.map((item) => `
      <tr><td>${escapeHtml(item.username || '-')}</td><td>${escapeHtml(item.organization_name || '-')}</td><td>${item.action === 'join' ? '申请加入' : '申请退出'}</td><td>${escapeHtml(formatTimestamp(item.requested_at))}</td><td><div class="actions"><button data-id="${item.id}" data-action="approve">批准</button><button class="danger" data-id="${item.id}" data-action="reject">拒绝</button></div></td></tr>
    `).join('') : rowMessage('暂无待处理的组织申请', 5);
    table.querySelectorAll('button[data-action]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await API.reviewOrgMembershipAsReviewer(button.dataset.id, button.dataset.action);
        // 先刷新再写提示：loadOrgRequests() 开头会清空提示区
        await loadOrgRequests();
        await loadLobby();
        status.textContent = button.dataset.action === 'approve' ? '申请已批准' : '申请已拒绝';
      } catch (error) { status.textContent = briefError(error); }
    }));
  } catch (error) { table.innerHTML = rowMessage(briefError(error), 5); }
}

async function loadEnterprisePassword() {
  const value = document.querySelector('#enterprisePasswordValue');
  const refresh = document.querySelector('#enterprisePasswordRefresh');
  try {
    const data = await API.reviewerEnterprisePassword();
    value.textContent = data.password || '-';
    refresh.textContent = `下次刷新：${formatTimestamp(data.next_refresh_at)}`;
  } catch (error) {
    value.textContent = '暂无法加载';
    refresh.textContent = briefError(error);
  }
}

async function loadEmployeeRequests() {
  const table = document.querySelector('#employeeRequestsTable');
  const status = document.querySelector('#employeeRequestStatus');
  table.innerHTML = rowMessage('加载中...', 3);
  status.textContent = '';
  try {
    const data = await API.reviewerRegistrationRequests();
    const requests = Array.isArray(data.requests) ? data.requests : [];
    table.innerHTML = requests.length ? requests.map((item) => `
      <tr><td>${escapeHtml(item.username || item.email || '-')}</td><td>${escapeHtml(formatTimestamp(item.created_at))}</td><td><div class="actions"><button data-id="${item.id}" data-action="approve">批准</button><button class="danger" data-id="${item.id}" data-action="reject">拒绝</button></div></td></tr>
    `).join('') : rowMessage('暂无待审批员工申请', 3);
    table.querySelectorAll('button[data-action]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await API.reviewEmployeeRegistration(button.dataset.id, button.dataset.action);
        status.textContent = button.dataset.action === 'approve' ? '申请已批准' : '申请已拒绝';
        await loadEmployeeRequests();
      } catch (error) { status.textContent = briefError(error); }
    }));
  } catch (error) { table.innerHTML = rowMessage(briefError(error), 3); }
}

async function toggleDeveloperView() {
  const panel = document.querySelector('#developerMetricsPanel');
  const button = document.querySelector('#developerViewButton');
  const visible = !panel.classList.contains('hidden');
  panel.classList.toggle('hidden', visible);
  document.querySelectorAll('.reviewer-work-panel').forEach((workPanel) => {
    workPanel.classList.toggle('hidden', !visible);
  });
  button.textContent = visible ? '开发者视图' : '返回审核';
  if (!visible) await loadMetrics();
}

async function loadSystemModules() {
  const status = document.querySelector('#systemModulesStatus');
  try {
    const modules = await API.systemModules();
    document.querySelector('#guidanceModule').value = modules.guidance?.content || '';
    document.querySelector('#toneModule').value = modules.tone?.content || '';
    document.querySelector('#forbiddenModule').value = modules.forbidden?.content || '';
    window.savedSystemModules = readSystemModuleValues();
    setSystemModulesEditing(false);
    status.textContent = '模块已加载';
  } catch (error) {
    status.textContent = briefError(error);
  }
}

function readSystemModuleValues() {
  return {
    guidance: document.querySelector('#guidanceModule').value,
    tone: document.querySelector('#toneModule').value,
    forbidden: document.querySelector('#forbiddenModule').value,
  };
}

function setSystemModulesEditing(editing) {
  ['guidanceModule', 'toneModule', 'forbiddenModule'].forEach((id) => {
    document.querySelector(`#${id}`).disabled = !editing;
  });
  document.querySelector('#editSystemModules').classList.toggle('hidden', editing);
  document.querySelector('#saveSystemModules').classList.toggle('hidden', !editing);
}

function beginSystemModulesEdit() {
  setSystemModulesEditing(true);
  document.querySelector('#systemModulesStatus').textContent = '正在编辑，保存前不会生效';
  document.querySelector('#guidanceModule').focus();
}

function openSystemModulesConfirm() {
  document.querySelector('#systemModulesConfirm').showModal();
}

function closeSystemModulesConfirm() {
  document.querySelector('#systemModulesConfirm').close();
}

function discardSystemModulesEdit() {
  const saved = window.savedSystemModules || { guidance: '', tone: '', forbidden: '' };
  Object.entries(saved).forEach(([name, value]) => {
    document.querySelector(`#${name}Module`).value = value;
  });
  closeSystemModulesConfirm();
  setSystemModulesEditing(false);
  document.querySelector('#systemModulesStatus').textContent = '已放弃本次修改';
}

async function saveSystemModules() {
  const button = document.querySelector('#confirmSystemModulesSave');
  const status = document.querySelector('#systemModulesStatus');
  button.disabled = true;
  status.textContent = '保存中...';
  try {
    const values = readSystemModuleValues();
    await API.saveSystemModules(values);
    window.savedSystemModules = values;
    closeSystemModulesConfirm();
    setSystemModulesEditing(false);
    status.textContent = '已保存，将从下一次请求开始生效';
  } catch (error) {
    setSystemModulesEditing(false);
    closeSystemModulesConfirm();
    status.textContent = briefError(error);
  } finally {
    button.disabled = false;
  }
}

async function loadMetrics() {
  const grid = document.querySelector('#metricsGrid');
  const timestamp = document.querySelector('#metricsTimestamp');
  grid.innerHTML = '<p class="muted">加载中...</p>';
  try {
    const data = await API.reviewerMetrics();
    const requests = data.requests || {};
    const modelCalls = data.model_calls || {};
    const errors = data.provider_errors || {};
    window.latestReviewerMetrics = data;
    timestamp.textContent = `数据截至 ${formatTimestamp(data.stats_since)}`;
    const cards = [
      ['请求总数', requests.total],
      ['成功', requests.success],
      ['降级', requests.degraded],
      ['错误', requests.error],
      ['快速调用', `${modelCalls.fast?.calls || 0} / ${modelCalls.fast?.average_elapsed_ms || 0}ms`],
      ['专家调用', `${modelCalls.expert?.calls || 0} / ${modelCalls.expert?.average_elapsed_ms || 0}ms`],
      ['搜索降级', data.search_fallback_count],
      ['DeepSeek 错误', errorSummary(errors.deepseek)],
    ];
    grid.innerHTML = cards.map(([label, value]) => `
      <div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></div>
    `).join('');
    renderStageTimingTable(data.recent_requests || []);
    renderRequestTrend(data.recent_requests || []);
    renderTraceDetail();
  } catch (error) {
    timestamp.textContent = '数据截至 -';
    grid.innerHTML = `<p class="message">${escapeHtml(briefError(error))}</p>`;
  }
}

function renderStageTimingTable(records) {
  const table = document.querySelector('#stageTimingTable');
  const stages = {};
  records.forEach((record) => {
    Object.entries(record.stage_timings || {}).forEach(([stage, elapsed]) => {
      const item = stages[stage] || { total: 0, count: 0 };
      item.total += Number(elapsed || 0);
      item.count += 1;
      stages[stage] = item;
    });
  });
  const rows = Object.entries(stages).sort((left, right) => right[1].total - left[1].total);
  table.innerHTML = rows.length ? rows.map(([stage, item]) => `
    <tr><td>${escapeHtml(stage)}</td><td>${Math.round(item.total / item.count)}ms</td><td>${item.count}</td></tr>
  `).join('') : rowMessage('暂无请求阶段数据', 3);
}

function renderTraceDetail() {
  const panel = document.querySelector('#traceDetail');
  const traceId = document.querySelector('#traceIdQuery').value.trim();
  if (!traceId) {
    panel.classList.add('hidden');
    return;
  }
  const records = window.latestReviewerMetrics?.recent_requests || [];
  const record = records.find((item) => item.trace_id === traceId);
  panel.classList.remove('hidden');
  if (!record) {
    panel.textContent = '未找到该 trace_id。';
    return;
  }
  const timings = Object.entries(record.stage_timings || {})
    .map(([stage, elapsed]) => `${escapeHtml(stage)}：${Number(elapsed || 0)}ms`)
    .join('；') || '无阶段耗时';
  panel.innerHTML = `
    <p>模式：${escapeHtml(record.mode || '-')}；状态：${escapeHtml(record.status || '-')}；总耗时：${Number(record.total_elapsed_ms || 0)}ms</p>
    <p>阶段：${timings}</p>
    <p>错误类型：${escapeHtml(record.error_type || '-')}</p>
  `;
}

function renderRequestTrend(records) {
  const chart = document.querySelector('#requestTrendChart');
  const table = document.querySelector('#requestTrendTable');
  const recent = records.slice(-30);
  table.innerHTML = recent.length ? recent.slice().reverse().map((record) => `
    <tr><td>${escapeHtml(formatTimestamp(record.timestamp))}</td><td>${escapeHtml(record.mode || '-')}</td><td>${Number(record.total_elapsed_ms || 0)}ms</td><td>${escapeHtml(record.status || '-')}</td></tr>
  `).join('') : rowMessage('暂无请求趋势数据', 4);
  if (!recent.length) {
    chart.innerHTML = '';
    return;
  }
  const width = 720;
  const height = 180;
  const padding = 24;
  const values = recent.map((record) => Number(record.total_elapsed_ms || 0));
  const maximum = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = padding + ((width - padding * 2) * index / Math.max(values.length - 1, 1));
    const y = height - padding - ((height - padding * 2) * value / maximum);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  chart.innerHTML = `
    <line class="trend-grid" x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" />
    <line class="trend-grid" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />
    <polyline class="trend-line" points="${points.join(' ')}" />
    ${points.map((point) => `<circle class="trend-point" cx="${point.split(',')[0]}" cy="${point.split(',')[1]}" r="2" />`).join('')}
    <text x="${padding}" y="16" fill="#666666" font-size="12">最大 ${maximum}ms</text>
  `;
}

function errorSummary(errors) {
  const values = errors || {};
  return `超时 ${values.timeout || 0} / 限流 ${values.rate_limit || 0} / 其他 ${values.other || 0}`;
}

function formatTimestamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function loadPending() {
  const table = document.querySelector('#pendingTable');
  if (!selectedReviewerOrganization) return;
  table.innerHTML = rowMessage('加载中...', 6);
  try {
    const data = await API.pendingDocuments(selectedReviewerOrganization.id);
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (!documents.length) {
      table.innerHTML = rowMessage('暂无待审核文档', 6);
      return;
    }
    table.innerHTML = documents
      .map((item) => `
        <tr>
          <td title="${escapeHtml(item.doc_id || '')}">${escapeHtml(shortId(item.doc_id || ''))}</td>
          <td title="${escapeHtml(item.source || '')}">
            ${escapeHtml(API.filename(item.source || ''))}
            ${item.converted_from ? `<div class="muted">转换来源：${escapeHtml(item.converted_from)}</div>` : ''}
          </td>
          <td>${escapeHtml(item.uploaded_by || '-')}</td>
          <td>${organizationLabel(item)}</td>
          <td>${escapeHtml(item.uploaded_at || '-')}</td>
          <td>
            <div class="actions">
              <button class="secondary" data-action="preview" data-doc-id="${escapeHtml(item.doc_id || '')}">预览</button>
              <button data-action="approve" data-doc-id="${escapeHtml(item.doc_id || '')}">批准</button>
              <button class="danger" data-action="reject" data-doc-id="${escapeHtml(item.doc_id || '')}">拒绝</button>
            </div>
          </td>
        </tr>
      `)
      .join('');
    table.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => handlePendingAction(button.dataset.action, button.dataset.docId));
    });
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 6);
  }
}

async function handlePendingAction(action, docId) {
  if (action === 'preview') {
    await previewDocument(docId, '#previewPanel');
    return;
  }
  await reviewDocument(action, docId);
}

async function previewDocument(docId, panelSelector = '#previewPanel') {
  if (!docId) return;
  const panel = document.querySelector(panelSelector);
  panel.classList.remove('hidden');
  panel.innerHTML = '<p class="muted">加载预览中...</p>';
  try {
    const data = await API.previewDocument(docId);
    const chunks = Array.isArray(data.chunks) ? data.chunks : [];
    panel.innerHTML = `
      <div class="section-title">
        <h2>文档预览</h2>
        <button class="secondary" id="closePreview" type="button">关闭</button>
      </div>
      <p class="muted">来源：${escapeHtml(data.source || '-')}</p>
      <p class="muted">共${chunks.length}段内容</p>
      <div class="preview-content">
        ${chunks.length ? chunks.map((chunk, index) => `
          <section class="preview-chunk">
            <h3>第${index + 1}段：</h3>
            <p>${escapeHtml(chunk)}</p>
          </section>
        `).join('') : '<p class="muted">暂无可预览内容</p>'}
      </div>
    `;
    panel.querySelector('#closePreview').addEventListener('click', () => {
      panel.classList.add('hidden');
      panel.innerHTML = '';
    });
  } catch (error) {
    panel.innerHTML = `<p class="message">${escapeHtml(briefError(error))}</p>`;
  }
}

async function reviewDocument(action, docId) {
  if (!docId) return;
  try {
    if (action === 'approve') {
      await API.approveDocument(docId);
    } else {
      await API.rejectDocument(docId);
    }
    await loadPending();
    await loadDocuments();
    await loadJoinedOrganizations();
    await loadStats();
    const panel = document.querySelector('#previewPanel');
    panel.classList.add('hidden');
    panel.innerHTML = '';
  } catch (error) {
    alert(briefError(error));
  }
}

async function loadDocuments() {
  const table = document.querySelector('#documentsTable');
  if (!selectedReviewerOrganization) return;
  table.innerHTML = rowMessage('加载中...', 6);
  try {
    const data = await API.listVerifiedDocuments(selectedReviewerOrganization.id);
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (!documents.length) {
      table.innerHTML = rowMessage('暂无已通过文档', 6);
      return;
    }
    table.innerHTML = documents
      .map((item) => `
        <tr>
          <td title="${escapeHtml(item.source || '')}">
            ${escapeHtml(API.filename(item.source || ''))}
            ${item.converted_from ? `<div class="muted">转换来源：${escapeHtml(item.converted_from)}</div>` : ''}
          </td>
          <td>${Number(item.chunk_count || 0)}</td>
          <td>${escapeHtml(item.uploaded_by || '-')}</td>
          <td>${organizationLabel(item)}</td>
          <td>${escapeHtml(item.reviewed_at || '-')}</td>
          <td><button class="danger" data-doc-id="${escapeHtml(item.doc_id || '')}" data-document-name="${escapeHtml(item.source || '')}">删除</button></td>
        </tr>
      `)
      .join('');
    table.querySelectorAll('tr').forEach((row, index) => {
      const item = documents[index] || {};
      const actionCell = row.querySelector('td:last-child');
      if (!actionCell) return;
      actionCell.innerHTML = `
        <div class="actions">
          <button class="secondary" data-doc-preview="${escapeHtml(item.doc_id || '')}">预览</button>
          <button class="danger" data-doc-id="${escapeHtml(item.doc_id || '')}" data-document-name="${escapeHtml(item.source || '')}">删除</button>
        </div>
      `;
    });
    table.querySelectorAll('button[data-doc-preview]').forEach((button) => {
      button.addEventListener('click', () => previewDocument(button.dataset.docPreview, '#documentPreviewPanel'));
    });
    table.querySelectorAll('button[data-doc-id]').forEach((button) => {
      button.addEventListener('click', () => deleteDocument(
        button.dataset.docId,
        button.dataset.documentName,
      ));
    });
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 6);
  }
}

async function deleteDocument(docId, documentName) {
  if (!docId) return;
  if (!confirm(`确认删除 ${API.filename(documentName || '')} 的全部chunk？`)) return;
  try {
    await API.deleteDocument(docId);
    await loadDocuments();
    await loadJoinedOrganizations();
    await loadStats();
  } catch (error) {
    alert(briefError(error));
  }
}


async function runDebugRetrieve() {
  const table = document.querySelector('#debugRetrieveTable');
  const thresholdText = document.querySelector('#debugThreshold');
  const query = document.querySelector('#debugQuery').value.trim();
  const topK = Number(document.querySelector('#debugTopK').value || 5);
  const includePending = document.querySelector('#debugIncludePending').checked;
  if (!query) {
    table.innerHTML = rowMessage('请输入检索内容', 7);
    thresholdText.textContent = '';
    return;
  }

  table.innerHTML = rowMessage('检索中...', 7);
  thresholdText.textContent = '';
  try {
    const data = await API.debugRetrieve(query, topK, includePending);
    const threshold = Number(data.threshold || 0);
    const results = Array.isArray(data.results) ? data.results : [];
    thresholdText.textContent = `当前采信阈值：最终分数不低于 ${threshold.toFixed(3)}；本表展示全部候选，不做阈值过滤。`;
    if (!results.length) {
      table.innerHTML = rowMessage('暂无候选结果', 7);
      return;
    }

    const sorted = [...results].sort((a, b) => Number(b.final_score || b.score || 0) - Number(a.final_score || a.score || 0));
    table.innerHTML = sorted
      .map((item) => {
        const vectorScore = Number(item.vector_score || 0);
        const score = Number(item.final_score || item.score || 0);
        const trusted = score >= threshold;
        return `
          <tr class="${trusted ? 'debug-trusted' : 'debug-low'}">
            <td title="${escapeHtml(item.source || '')}">${escapeHtml(API.filename(item.source || ''))}</td>
            <td title="${escapeHtml(item.doc_id || '')}">${escapeHtml(shortId(item.doc_id || ''))}</td>
            <td>${statusBadge(item.status || '')}</td>
            <td>${Number(item.chunk_index || 0)}</td>
            <td>${vectorScore.toFixed(6)}</td>
            <td><span class="badge">${item.title_boosted ? '是' : '否'}</span></td>
            <td><span class="score-badge ${trusted ? 'score-ok' : 'score-low'}">${score.toFixed(6)}</span></td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 7);
  }
}
async function loadStats() {
  try {
    const data = await API.health();
    const memory = data.layers?.memory || {};
    document.querySelector('#vectorCount').textContent = memory.document_chunks ?? memory.chroma_count ?? '-';
    document.querySelector('#sqliteCount').textContent = memory.sqlite_conversations ?? '-';
  } catch (error) {
    document.querySelector('#vectorCount').textContent = '-';
    document.querySelector('#sqliteCount').textContent = '-';
  }
}


function statusBadge(status) {
  const safeStatus = status === 'pending' ? 'pending' : 'verified';
  const label = safeStatus === 'pending' ? '待审核' : '已通过';
  return `<span class="status-badge status-${safeStatus}">${label}</span>`;
}

function shortId(value) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

// 组织列容错：当前设计下文档必有归属组织，但孤儿chunk兜底行等场景可能缺字段，
// 统一渲染为"—"，避免单元格空白导致整行列错位。
function organizationLabel(item) {
  const name = (item && item.organization_name) || '';
  return name ? escapeHtml(name) : '<span class="muted">—</span>';
}

function rowMessage(text, colspan) {
  return `<tr><td colspan="${colspan}" class="muted">${escapeHtml(text)}</td></tr>`;
}

function briefError(error) {
  const text = String(error.message || error).replaceAll('\n', ' ');
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

