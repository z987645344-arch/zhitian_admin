if (API.ensureRole(['employee', 'reviewer'])) {
  initEmployeePage();
}

let employeeJoinedOrganizations = [];
let selectedEmployeeOrganization = null;

function initEmployeePage() {
  document.querySelector('#currentUser').textContent = `当前账号：${localStorage.getItem('username') || '-'}`;
  AccountSwitcher.mount();
  document.querySelector('#logoutButton').addEventListener('click', () => AccountSwitcher.handleLogout());
  document.querySelector('#uploadForm').addEventListener('submit', uploadDocument);
  document.querySelector('#documentFile').addEventListener('change', showConversionHint);
  document.querySelector('#knowledgeForm').addEventListener('submit', inputKnowledge);
  document.querySelector('#refreshDocuments').addEventListener('click', refreshDocumentViews);
  document.querySelector('#refreshJoinedOrganizations').addEventListener('click', () => loadJoinedOrganizations());
  document.querySelector('#backToEmployeeOrganizations').addEventListener('click', showEmployeeOrganizationList);
  document.querySelector('#refreshLobby').addEventListener('click', loadLobby);
  loadLobby();
}

// 当前组织的文档列表与组织卡片统计始终一起刷新，避免上传/撤销后计数过期。
async function refreshDocumentViews() {
  await loadDocuments();
  await loadJoinedOrganizations();
}

async function loadJoinedOrganizations(joinedFromLobby = null) {
  const box = document.querySelector('#employeeJoinedOrganizations');
  box.innerHTML = '<p class="muted">组织加载中...</p>';
  try {
    const [directoryData, statsData] = await Promise.all([
      joinedFromLobby
        ? Promise.resolve({ organizations: joinedFromLobby })
        : API.organizationsDirectory(),
      API.myDocumentsByOrganization(),
    ]);
    const directory = Array.isArray(directoryData.organizations)
      ? directoryData.organizations.filter((item) => item.my_status === 'joined')
      : [];
    const counts = new Map(
      (statsData.organizations || []).map((item) => [
        Number(item.organization_id),
        Number(item.document_count || 0),
      ]),
    );
    employeeJoinedOrganizations = directory.map((item) => ({
      ...item,
      document_count: counts.get(Number(item.id)) || 0,
    }));
    renderEmployeeOrganizations();
    if (
      selectedEmployeeOrganization
      && !employeeJoinedOrganizations.some(
        (item) => Number(item.id) === Number(selectedEmployeeOrganization.id),
      )
    ) {
      showEmployeeOrganizationList();
    }
  } catch (error) {
    box.innerHTML = `<p class="muted">组织加载失败：${escapeHtml(briefError(error))}</p>`;
  }
}

function renderEmployeeOrganizations() {
  const box = document.querySelector('#employeeJoinedOrganizations');
  box.innerHTML = employeeJoinedOrganizations.length
    ? employeeJoinedOrganizations.map((item) => `
        <article class="organization-work-card">
          <div><h3>${escapeHtml(item.name || '未命名组织')}</h3><p>${item.content ? escapeHtml(item.content) : '暂无组织简介'}</p></div>
          <div class="organization-work-counts single">
            <span>我上传的文档<strong>${Number(item.document_count || 0)}</strong></span>
          </div>
          <button type="button" data-open-employee-org="${Number(item.id)}">进入组织</button>
        </article>
      `).join('')
    : '<p class="muted">尚未加入任何组织，请先在组织大厅申请加入。</p>';
  box.querySelectorAll('button[data-open-employee-org]').forEach((button) => {
    button.addEventListener('click', () => openEmployeeOrganization(button.dataset.openEmployeeOrg));
  });
}

async function openEmployeeOrganization(organizationId) {
  const organization = employeeJoinedOrganizations.find(
    (item) => Number(item.id) === Number(organizationId),
  );
  if (!organization) return;
  selectedEmployeeOrganization = organization;
  document.querySelector('#employeeOrganizationTitle').textContent = organization.name || '组织详情';
  document.querySelector('#employeeOrganizationSummary').textContent = organization.content || '暂无组织简介';
  document.querySelector('#employeeOrganizationListView').classList.add('hidden');
  document.querySelector('#employeeOrganizationDetail').classList.remove('hidden');
  await loadDocuments();
}

function showEmployeeOrganizationList() {
  selectedEmployeeOrganization = null;
  document.querySelector('#employeeOrganizationDetail').classList.add('hidden');
  document.querySelector('#employeeOrganizationListView').classList.remove('hidden');
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
  const notice = document.querySelector('#workGateNotice');
  notice.textContent = hasOrganization ? '' : '请先在组织大厅申请加入至少一个组织，加入后才能上传文档或录入知识。';
  notice.classList.toggle('hidden', hasOrganization);
  loadJoinedOrganizations(organizations);
}

// F36：与后端config.MAX_UPLOAD_SIZE_MB保持一致，改动时需同步。
// F37：换中文嵌入模型后向量化降到约21切片/秒，故由2MB再下调到1MB。
// 服务端另有切片数上限（2000）作为更精确的控制，前端只做体积预筛。
const MAX_UPLOAD_MB = 1;

function formatSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function showConversionHint(event) {
  const file = event.target.files && event.target.files[0];
  const message = document.querySelector('#uploadMessage');
  const extension = file && file.name.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : '';
  const convertible = new Set(['.doc', '.xls', '.xlsx', '.ppt', '.pptx']);
  const hints = [];
  if (file && file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    // 前端提前拦住，不让请求发出去才被后端拒绝
    message.textContent = `文件 ${formatSize(file.size)}，超出 ${MAX_UPLOAD_MB}MB 上限，请拆分后再上传`;
    message.classList.remove('success');
    return;
  }
  if (convertible.has(extension)) hints.push('该格式将自动转换后上传');
  // 入库需要为全文生成向量，体积越大越慢；这里给一个量级提示而非精确预测
  if (file && file.size > 512 * 1024) hints.push('文件较大，入库可能需要 1 分钟以上，请勿关闭页面');
  message.textContent = hints.join('；');
  message.classList.remove('success');
}

async function uploadDocument(event) {
  event.preventDefault();
  const input = document.querySelector('#documentFile');
  const message = document.querySelector('#uploadMessage');
  const resultBox = document.querySelector('#uploadResult');
  const uploadButton = document.querySelector('#uploadButton');
  const file = input.files && input.files[0];
  if (!file || !selectedEmployeeOrganization) return;
  // 提交前再拦一次：避免选文件后才超限、或未触发change事件的情况
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    message.textContent = `文件 ${formatSize(file.size)}，超出 ${MAX_UPLOAD_MB}MB 上限，请拆分后再上传`;
    message.classList.remove('success');
    return;
  }

  uploadButton.disabled = true;
  showConversionHint({ target: input });
  message.classList.remove('success');
  resultBox.classList.add('hidden');

  try {
    const result = await API.uploadDocument(file, selectedEmployeeOrganization.id);
    message.textContent = '文档已提交，等待审核员审核后生效';
    message.classList.add('success');
    resultBox.innerHTML = `
      <div>文档编号：<strong>${escapeHtml(result.doc_id || '-')}</strong></div>
      <div>审核状态：<span class="badge">${statusText(result.trust_level || 'unknown')}</span></div>
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
  if (!content || !selectedEmployeeOrganization) return;

  button.disabled = true;
  message.textContent = '';
  message.classList.remove('success');
  resultBox.classList.add('hidden');

  try {
    const result = await API.inputKnowledge(title, content, selectedEmployeeOrganization.id);
    message.textContent = '已提交，等待审核员审核后生效';
    message.classList.add('success');
    resultBox.innerHTML = `
      <div>文档编号：<strong>${escapeHtml(result.doc_id || '-')}</strong></div>
      <div>审核状态：<span class="badge">${statusText(result.trust_level || 'unknown')}</span></div>
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
  if (!selectedEmployeeOrganization) return;
  table.innerHTML = rowMessage('加载中...', 6);
  try {
    const data = await API.listDocuments();
    const documents = Array.isArray(data.documents)
      ? data.documents.filter(
        (item) => Number(item.organization_id) === Number(selectedEmployeeOrganization.id),
      )
      : [];
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
