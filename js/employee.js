if (API.ensureRole(['employee', 'reviewer'])) {
  initEmployeePage();
}

function initEmployeePage() {
  document.querySelector('#currentUser').textContent = `当前账号：${localStorage.getItem('username') || '-'}`;
  AccountSwitcher.mount();
  document.querySelector('#logoutButton').addEventListener('click', () => AccountSwitcher.handleLogout());
  document.querySelector('#uploadForm').addEventListener('submit', uploadDocument);
  document.querySelector('#documentFile').addEventListener('change', showConversionHint);
  document.querySelector('#knowledgeForm').addEventListener('submit', inputKnowledge);
  document.querySelector('#refreshDocuments').addEventListener('click', refreshDocumentViews);
  document.querySelector('#refreshLobby').addEventListener('click', loadLobby);
  loadLobby();
  refreshDocumentViews();
}

// 文档列表与按组织统计始终一起刷新，避免上传/撤销后统计过期
async function refreshDocumentViews() {
  await loadDocuments();
  await loadOrgDocSummary();
}

// 按组织统计"我上传的"文档数；加载失败只在本区域内提示，不影响页面其他部分
async function loadOrgDocSummary() {
  const box = document.querySelector('#orgDocSummary');
  if (!box) return;
  box.innerHTML = '<span class="muted">统计加载中...</span>';
  try {
    const data = await API.myDocumentsByOrganization();
    const items = Array.isArray(data.organizations) ? data.organizations : [];
    box.innerHTML = items.length
      ? items.map((item) => `
          <span class="org-doc-chip">${escapeHtml(item.organization_name || '—')}
            <strong>${Number(item.document_count || 0)}</strong>
          </span>`).join('')
      : '<span class="muted">你还没有在任何组织上传过文档</span>';
  } catch (error) {
    box.innerHTML = `<span class="muted">统计加载失败：${escapeHtml(briefError(error))}</span>`;
  }
}

function loadLobby() {
  return OrgLobby.load({
    lobbySelector: '#lobbyContent',
    directorySelector: '#organizationDirectory',
    messageSelector: '#lobbyMessage',
    onChange: applyWorkGate,
  });
}

// 工作资格门槛：未加入任何自定义组织时直接禁用提交入口，
// 而不是让用户点击后才收到后端403。后端仍是唯一权威判断。
function applyWorkGate(joinedOrganizations) {
  const organizations = Array.isArray(joinedOrganizations) ? joinedOrganizations : [];
  const hasOrganization = organizations.length > 0;
  renderOrgTargets(organizations);
  const notice = document.querySelector('#workGateNotice');
  notice.textContent = hasOrganization ? '' : '请先在上方组织目录申请加入至少一个组织，加入后才能上传文档或录入知识。';
  notice.classList.toggle('hidden', hasOrganization);
  ['#uploadButton', '#documentFile', '#knowledgeButton', '#knowledgeTitle', '#knowledgeContent'].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) element.disabled = !hasOrganization;
  });
  ['#upload-section', '#entry-section'].forEach((selector) => {
    const section = document.querySelector(selector);
    if (section) section.classList.toggle('panel-locked', !hasOrganization);
  });
}

// 上传目标组织：只加入一个时渲染为只读提示，多个时渲染下拉。
// 无论哪种形态，请求都显式带上 organization_id——后端不做自动推断。
function renderOrgTargets(organizations) {
  ['#uploadOrgField', '#knowledgeOrgField'].forEach((selector) => {
    const box = document.querySelector(selector);
    if (!box) return;
    const key = selector === '#uploadOrgField' ? 'upload' : 'knowledge';
    if (!organizations.length) {
      box.innerHTML = '';
      return;
    }
    if (organizations.length === 1) {
      const only = organizations[0];
      box.innerHTML = `<p class="org-target-readonly">将上传至：<strong>${escapeHtml(only.name)}</strong></p>
        <input type="hidden" id="${key}OrgId" value="${Number(only.id)}" />`;
      return;
    }
    const options = organizations
      .map((item) => `<option value="${Number(item.id)}">${escapeHtml(item.name)}</option>`)
      .join('');
    box.innerHTML = `<label class="org-target-select"><span>上传至组织</span><select id="${key}OrgId">${options}</select></label>`;
  });
}

function selectedOrganizationId(key) {
  const element = document.querySelector(`#${key}OrgId`);
  return element ? Number(element.value) : null;
}

function showConversionHint(event) {
  const file = event.target.files && event.target.files[0];
  const message = document.querySelector('#uploadMessage');
  const extension = file && file.name.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : '';
  const convertible = new Set(['.doc', '.xls', '.xlsx', '.ppt', '.pptx']);
  message.textContent = convertible.has(extension) ? '该格式将自动转换后上传' : '';
  message.classList.remove('success');
}

async function uploadDocument(event) {
  event.preventDefault();
  const input = document.querySelector('#documentFile');
  const message = document.querySelector('#uploadMessage');
  const resultBox = document.querySelector('#uploadResult');
  const uploadButton = document.querySelector('#uploadButton');
  const file = input.files && input.files[0];
  if (!file) return;

  uploadButton.disabled = true;
  showConversionHint({ target: input });
  message.classList.remove('success');
  resultBox.classList.add('hidden');

  try {
    const result = await API.uploadDocument(file, selectedOrganizationId('upload'));
    message.textContent = '文档已提交，等待审核员审核后生效';
    message.classList.add('success');
    resultBox.innerHTML = `
      <div>doc_id：<strong>${escapeHtml(result.doc_id || '-')}</strong></div>
      <div>trust_level：<span class="badge">${escapeHtml(result.trust_level || '-')}</span></div>
      <div>source：${escapeHtml(result.source || '-')}</div>
      <div>chunks：${Number(result.chunks || 0)}</div>
    `;
    resultBox.classList.remove('hidden');
    input.value = '';
    await refreshDocumentViews();
  } catch (error) {
    message.textContent = briefError(error);
  } finally {
    uploadButton.disabled = false;
  }
}

async function inputKnowledge(event) {
  event.preventDefault();
  const titleInput = document.querySelector('#knowledgeTitle');
  const contentInput = document.querySelector('#knowledgeContent');
  const message = document.querySelector('#knowledgeMessage');
  const resultBox = document.querySelector('#knowledgeResult');
  const button = document.querySelector('#knowledgeButton');
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  if (!content) return;

  button.disabled = true;
  message.textContent = '';
  message.classList.remove('success');
  resultBox.classList.add('hidden');

  try {
    const result = await API.inputKnowledge(title, content, selectedOrganizationId('knowledge'));
    message.textContent = '已提交，等待审核员审核后生效';
    message.classList.add('success');
    resultBox.innerHTML = `
      <div>doc_id：<strong>${escapeHtml(result.doc_id || '-')}</strong></div>
      <div>trust_level：<span class="badge">${escapeHtml(result.trust_level || '-')}</span></div>
      <div>source：${escapeHtml(result.source || '-')}</div>
      <div>chunks：${Number(result.chunks || 0)}</div>
    `;
    resultBox.classList.remove('hidden');
    titleInput.value = '';
    contentInput.value = '';
    await refreshDocumentViews();
  } catch (error) {
    message.textContent = briefError(error);
  } finally {
    button.disabled = false;
  }
}

async function loadDocuments() {
  const table = document.querySelector('#documentsTable');
  table.innerHTML = rowMessage('加载中...', 6);
  try {
    const data = await API.listDocuments();
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (!documents.length) {
      table.innerHTML = rowMessage('暂无文档', 6);
      return;
    }
    table.innerHTML = documents
      .map((item) => `
        <tr>
          <td title="${escapeHtml(item.source || '')}">${escapeHtml(API.filename(item.source || ''))}</td>
          <td>${Number(item.chunk_count || 0)}</td>
          <td>${organizationLabel(item)}</td>
          <td>${escapeHtml(item.uploaded_at || '-')}</td>
          <td>${statusBadge(item.trust_level || 'unknown')}</td>
          <td>${documentAction(item)}</td>
        </tr>
      `)
      .join('');
    table.querySelectorAll('button[data-doc-id]').forEach((button) => {
      button.addEventListener('click', () => revokeDocument(
        button.dataset.docId,
        button.dataset.documentName,
      ));
    });
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 6);
  }
}

async function revokeDocument(docId, documentName) {
  if (!docId) return;
  if (!confirm(`确认撤销 ${API.filename(documentName || '')}？`)) return;
  try {
    await API.deleteDocument(docId);
    alert('已撤销，文档已从知识库移除');
    await refreshDocumentViews();
  } catch (error) {
    alert(briefError(error));
  }
}

function documentAction(item) {
  if (item.can_revoke) {
    return `<button class="danger" data-doc-id="${escapeHtml(item.doc_id || '')}" data-document-name="${escapeHtml(item.source || '')}">撤销</button>`;
  }
  return `<span class="muted">${statusText(item.trust_level || 'unknown')}</span>`;
}

function statusBadge(status) {
  return `<span class="badge ${statusClass(status)}">${statusText(status)}</span>`;
}

function statusText(status) {
  const map = {
    pending: '待审核',
    verified: '已通过',
    rejected: '已拒绝',
    unknown: '未知',
  };
  return map[status] || status;
}

function statusClass(status) {
  if (status === 'pending') return 'badge-pending';
  if (status === 'rejected') return 'badge-rejected';
  return '';
}

// 组织列容错：缺字段时渲染"—"，避免空单元格导致列错位。
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
