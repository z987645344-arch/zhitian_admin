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
  loadPending();
  loadDocuments();
  loadStats();
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
          <td title="${escapeHtml(item.source || '')}">${escapeHtml(API.filename(item.source || ''))}</td>
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
