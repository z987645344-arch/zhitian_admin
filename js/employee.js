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
  document.querySelector('#knowledgeForm').addEventListener('submit', inputKnowledge);
  document.querySelector('#refreshDocuments').addEventListener('click', loadDocuments);
  loadDocuments();
}

async function uploadDocument(event) {
  event.preventDefault();
  const input = document.querySelector('#filePath');
  const message = document.querySelector('#uploadMessage');
  const resultBox = document.querySelector('#uploadResult');
  const uploadButton = document.querySelector('#uploadButton');
  const filePath = input.value.trim();
  if (!filePath) return;

  uploadButton.disabled = true;
  message.textContent = '';
  message.classList.remove('success');
  resultBox.classList.add('hidden');

  try {
    const result = await API.uploadDocument(filePath);
    message.textContent = '文档已提交，等待审核员审核后生效';
    message.classList.add('success');
    resultBox.innerHTML = `
      <div>doc_id：<strong>${escapeHtml(result.doc_id || '-')}</strong></div>
      <div>trust_level：<span class="badge">${escapeHtml(result.trust_level || '-')}</span></div>
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
  table.innerHTML = rowMessage('加载中...', 3);
  try {
    const data = await API.listDocuments();
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (!documents.length) {
      table.innerHTML = rowMessage('暂无文档', 3);
      return;
    }
    table.innerHTML = documents
      .map((item) => `
        <tr>
          <td title="${escapeHtml(item.source || '')}">${escapeHtml(API.filename(item.source || ''))}</td>
          <td>${Number(item.chunk_count || 0)}</td>
          <td>${escapeHtml(item.uploaded_at || '-')}</td>
        </tr>
      `)
      .join('');
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 3);
  }
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
