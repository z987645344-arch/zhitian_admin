if (API.ensureRole(['reviewer'])) {
  initReviewerPage();
}

let pendingDangerTarget = '';

function initReviewerPage() {
  document.querySelector('#currentUser').textContent = `当前账号：${localStorage.getItem('username') || '-'}`;
  document.querySelector('#logoutButton').addEventListener('click', () => {
    API.logout();
    location.replace('./login.html');
  });
  document.querySelector('#refreshPending').addEventListener('click', loadPending);
  document.querySelector('#refreshDocuments').addEventListener('click', loadDocuments);
  document.querySelector('#refreshStats').addEventListener('click', loadStats);
  document.querySelector('#refreshKnowledge').addEventListener('click', loadKnowledgeBase);
  document.querySelectorAll('button[data-danger-target]').forEach((button) => {
    button.addEventListener('click', () => openDangerDialog(button.dataset.dangerTarget));
  });
  document.querySelector('#confirmDangerButton').addEventListener('click', confirmDangerOperation);
  document.querySelector('#cancelDangerButton').addEventListener('click', closeDangerDialog);
  loadPending();
  loadDocuments();
  loadStats();
  loadKnowledgeBase();
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
          <td title="${escapeHtml(item.source || '')}">${escapeHtml(API.filename(item.source || ''))}</td>
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
    await previewDocument(docId);
    return;
  }
  await reviewDocument(action, docId);
}

async function previewDocument(docId) {
  if (!docId) return;
  const panel = document.querySelector('#previewPanel');
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
    document.querySelector('#closePreview').addEventListener('click', () => {
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
  table.innerHTML = rowMessage('加载中...', 4);
  try {
    const data = await API.listDocuments();
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (!documents.length) {
      table.innerHTML = rowMessage('暂无文档', 4);
      return;
    }
    table.innerHTML = documents
      .map((item) => `
        <tr>
          <td title="${escapeHtml(item.source || '')}">${escapeHtml(API.filename(item.source || ''))}</td>
          <td>${Number(item.chunk_count || 0)}</td>
          <td>${escapeHtml(item.uploaded_at || '-')}</td>
          <td><button class="danger" data-source="${escapeHtml(item.source || '')}">删除</button></td>
        </tr>
      `)
      .join('');
    table.querySelectorAll('button[data-source]').forEach((button) => {
      button.addEventListener('click', () => deleteDocument(button.dataset.source));
    });
  } catch (error) {
    table.innerHTML = rowMessage(briefError(error), 4);
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

async function loadKnowledgeBase() {
  setKnowledgeLoading();
  try {
    const data = await API.adminKnowledge();
    const documents = Array.isArray(data.documents) ? data.documents : [];
    const manualInputs = Array.isArray(data.manual_inputs) ? data.manual_inputs : [];
    const memoryFragments = Array.isArray(data.memory_fragments) ? data.memory_fragments : [];

    document.querySelector('#documentsCount').textContent = documents.length;
    document.querySelector('#manualInputsCount').textContent = manualInputs.length;
    document.querySelector('#memoryFragmentsCount').textContent = memoryFragments.length;
    document.querySelector('#knowledgeDocuments').innerHTML = renderKnowledgeItems(
      documents,
      (item) => API.filename(item.source || '-'),
      (item) => item.trust_level || '-',
      (item) => item.chunks || []
    );
    document.querySelector('#knowledgeManualInputs').innerHTML = renderKnowledgeItems(
      manualInputs,
      (item) => (item.source || '').replace('manual_input:', '') || '-',
      (item) => item.trust_level || '-',
      (item) => item.chunks || []
    );
    document.querySelector('#knowledgeMemoryFragments').innerHTML = renderKnowledgeItems(
      memoryFragments,
      (item) => item.session_id || '-',
      () => '记忆',
      (item) => [item.content || '']
    );
  } catch (error) {
    const message = `<p class="message">${escapeHtml(briefError(error))}</p>`;
    document.querySelector('#knowledgeDocuments').innerHTML = message;
    document.querySelector('#knowledgeManualInputs').innerHTML = '';
    document.querySelector('#knowledgeMemoryFragments').innerHTML = '';
  }
}

function setKnowledgeLoading() {
  document.querySelector('#knowledgeDocuments').innerHTML = '<p class="muted">加载中...</p>';
  document.querySelector('#knowledgeManualInputs').innerHTML = '<p class="muted">加载中...</p>';
  document.querySelector('#knowledgeMemoryFragments').innerHTML = '<p class="muted">加载中...</p>';
}

function renderKnowledgeItems(items, titleOf, statusOf, chunksOf) {
  if (!items.length) return '<p class="muted">暂无内容</p>';
  return items.map((item) => {
    const title = titleOf(item);
    const status = statusOf(item);
    const chunks = chunksOf(item);
    const fullContent = chunks.join('\n\n');
    const preview = briefText(fullContent, 50);
    return `
      <details class="knowledge-item">
        <summary>
          <span title="${escapeHtml(title)}">${escapeHtml(title)}</span>
          <span>${escapeHtml(status)}</span>
          <span>${escapeHtml(preview || '-')}</span>
        </summary>
        <pre>${escapeHtml(fullContent || '暂无内容')}</pre>
      </details>
    `;
  }).join('');
}

function openDangerDialog(target) {
  pendingDangerTarget = target || '';
  document.querySelector('#adminSecretInput').value = '';
  document.querySelector('#dangerDialog').classList.remove('hidden');
  document.querySelector('#adminSecretInput').focus();
}

function closeDangerDialog() {
  pendingDangerTarget = '';
  document.querySelector('#dangerDialog').classList.add('hidden');
}

async function confirmDangerOperation() {
  const secret = document.querySelector('#adminSecretInput').value;
  const message = document.querySelector('#dangerMessage');
  if (!pendingDangerTarget || !secret) return;
  try {
    const result = await API.adminDeleteMemory(pendingDangerTarget, secret);
    closeDangerDialog();
    message.textContent = result.deleted || '操作完成';
    message.classList.add('success');
    await loadKnowledgeBase();
    await loadStats();
    await loadDocuments();
    await loadPending();
  } catch (error) {
    message.textContent = error.message && error.message.includes('密码')
      ? '密码错误'
      : briefError(error);
    message.classList.remove('success');
  }
}

function shortId(value) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function briefText(value, length) {
  const text = String(value || '').replaceAll('\n', ' ').trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
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
