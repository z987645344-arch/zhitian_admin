if (API.ensureRole(['reviewer'])) {
  initReviewerPage();
}

function initReviewerPage() {
  document.querySelector('#currentUser').textContent = `当前账号：${localStorage.getItem('username') || '-'}`;
  document.querySelector('#logoutButton').addEventListener('click', () => {
    API.logout();
    location.replace('./login.html');
  });
  document.querySelector('#refreshPending').addEventListener('click', loadPending);
  document.querySelector('#refreshDocuments').addEventListener('click', loadDocuments);
  document.querySelector('#refreshStats').addEventListener('click', loadStats);
  document.querySelector('#refreshEmployeeRequests').addEventListener('click', loadEmployeeRequests);
  document.querySelector('#refreshPasswordResets').addEventListener('click', loadPasswordResetEvents);
  document.querySelector('#runDebugRetrieve').addEventListener('click', runDebugRetrieve);
  document.querySelector('#debugQuery').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runDebugRetrieve();
  });
  loadPending();
  loadDocuments();
  loadStats();
  loadEmployeeRequests();
  loadPasswordResetEvents();
  loadEnterprisePassword();
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

async function loadPasswordResetEvents() {
  const table = document.querySelector('#passwordResetTable');
  table.innerHTML = rowMessage('加载中...', 2);
  try {
    const data = await API.reviewerPasswordResetEvents();
    const events = Array.isArray(data.events) ? data.events : [];
    table.innerHTML = events.length ? events.map((item) => `<tr><td>${escapeHtml(item.username || '-')}</td><td>${escapeHtml(formatTimestamp(item.created_at))}</td></tr>`).join('') : rowMessage('暂无密码重置记录', 2);
  } catch (error) { table.innerHTML = rowMessage(briefError(error), 2); }
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
  table.innerHTML = rowMessage('加载中...', 5);
  try {
    const data = await API.pendingDocuments();
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (!documents.length) {
      table.innerHTML = rowMessage('暂无待审核文档', 5);
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
    table.innerHTML = rowMessage(briefError(error), 5);
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
  table.innerHTML = rowMessage('加载中...', 5);
  try {
    const data = await API.listVerifiedDocuments();
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (!documents.length) {
      table.innerHTML = rowMessage('暂无已通过文档', 5);
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
          <td>${escapeHtml(item.reviewed_at || '-')}</td>
          <td><button class="danger" data-source="${escapeHtml(item.source || '')}">删除</button></td>
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
          <button class="danger" data-source="${escapeHtml(item.source || '')}">删除</button>
        </div>
      `;
    });
    table.querySelectorAll('button[data-doc-preview]').forEach((button) => {
      button.addEventListener('click', () => previewDocument(button.dataset.docPreview, '#documentPreviewPanel'));
    });
    table.querySelectorAll('button[data-source]').forEach((button) => {
      button.addEventListener('click', () => deleteDocument(button.dataset.source));
    });
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 5);
  }
}

async function deleteDocument(source) {
  if (!source) return;
  if (!confirm(`确认删除 ${API.filename(source)} 的全部chunk？`)) return;
  try {
    await API.deleteDocument(source);
    await loadDocuments();
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
    table.innerHTML = rowMessage('请输入query', 7);
    thresholdText.textContent = '';
    return;
  }

  table.innerHTML = rowMessage('检索中...', 7);
  thresholdText.textContent = '';
  try {
    const data = await API.debugRetrieve(query, topK, includePending);
    const threshold = Number(data.threshold || 0);
    const results = Array.isArray(data.results) ? data.results : [];
    thresholdText.textContent = `当前采信阈值：score >= ${threshold.toFixed(3)}；本表展示完整候选，不做阈值过滤。`;
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
  const label = safeStatus === 'pending' ? 'pending' : 'verified';
  return `<span class="status-badge status-${safeStatus}">${label}</span>`;
}

function shortId(value) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
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

