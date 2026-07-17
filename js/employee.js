if (API.ensureRole(['employee', 'reviewer'])) {
  initEmployeePage();
}

function initEmployeePage() {
  document.querySelector('#currentUser').textContent = `当前账号：${localStorage.getItem('username') || '-'}`;
  document.querySelector('#logoutButton').addEventListener('click', () => {
    API.logout();
    location.replace('./login.html');
  });
  document.querySelector('#uploadForm').addEventListener('submit', uploadDocument);
  document.querySelector('#documentFile').addEventListener('change', showConversionHint);
  document.querySelector('#knowledgeForm').addEventListener('submit', inputKnowledge);
  document.querySelector('#refreshDocuments').addEventListener('click', loadDocuments);
  loadDocuments();
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
    const result = await API.uploadDocument(file);
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
    await loadDocuments();
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
    const result = await API.inputKnowledge(title, content);
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
    await loadDocuments();
  } catch (error) {
    message.textContent = briefError(error);
  } finally {
    button.disabled = false;
  }
}

async function loadDocuments() {
  const table = document.querySelector('#documentsTable');
  table.innerHTML = rowMessage('加载中...', 5);
  try {
    const data = await API.listDocuments();
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (!documents.length) {
      table.innerHTML = rowMessage('暂无文档', 5);
      return;
    }
    table.innerHTML = documents
      .map((item) => `
        <tr>
          <td title="${escapeHtml(item.source || '')}">${escapeHtml(API.filename(item.source || ''))}</td>
          <td>${Number(item.chunk_count || 0)}</td>
          <td>${escapeHtml(item.uploaded_at || '-')}</td>
          <td>${statusBadge(item.trust_level || 'unknown')}</td>
          <td>${documentAction(item)}</td>
        </tr>
      `)
      .join('');
    table.querySelectorAll('button[data-source]').forEach((button) => {
      button.addEventListener('click', () => revokeDocument(button.dataset.source));
    });
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 5);
  }
}

async function revokeDocument(source) {
  if (!source) return;
  if (!confirm(`确认撤销 ${API.filename(source)}？`)) return;
  try {
    await API.deleteDocument(source);
    alert('已撤销，文档已从知识库移除');
    await loadDocuments();
  } catch (error) {
    alert(briefError(error));
  }
}

function documentAction(item) {
  if (item.can_revoke) {
    return `<button class="danger" data-source="${escapeHtml(item.source || '')}">撤销</button>`;
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
