// 组织大厅：employee 与 reviewer 工作台共用。
// 上半部分是"默认"大厅的公司级静态信息（只读，由 developer 维护），
// 下半部分是可申请加入/退出的功能群目录。"默认"组织不出现在目录里——
// 所有账号自动在内、不可退出，不参与申请流程。
const OrgLobby = (() => {
  const STATUS_TEXT = {
    none: '未加入',
    pending_join: '加入审批中',
    joined: '已加入',
    pending_leave: '退出审批中',
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function briefError(error) {
    const text = String(error.message || error).replaceAll('\n', ' ');
    return text.length > 90 ? `${text.slice(0, 90)}...` : text;
  }

  function lobbyBlock(title, body) {
    return `
      <article class="lobby-block">
        <h3>${escapeHtml(title)}</h3>
        <p>${body ? escapeHtml(body) : '<span class="muted">暂未设置</span>'}</p>
      </article>
    `;
  }

  function renderLobbyContent(container, content) {
    container.innerHTML = `
      ${lobbyBlock('工具使用规则', content.tool_rules)}
      ${lobbyBlock('企业公告', content.company_announcements)}
      ${lobbyBlock('行业准则', content.industry_standards)}
    `;
  }

  function actionButton(item) {
    if (item.my_status === 'none') {
      return `<button data-org-action="join" data-org-id="${Number(item.id)}">申请加入</button>`;
    }
    if (item.my_status === 'joined') {
      return `<button class="secondary" data-org-action="leave" data-org-id="${Number(item.id)}">申请退出</button>`;
    }
    return '<span class="muted">审批中</span>';
  }

  function organizationCard(item) {
    const status = STATUS_TEXT[item.my_status] || item.my_status;
    const summary = item.content ? escapeHtml(item.content) : '<span class="muted">暂无简介</span>';
    return `
      <article class="org-card">
        <div class="org-card-head">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="badge ${item.my_status === 'joined' ? 'status-verified' : 'badge-pending'}">${escapeHtml(status)}</span>
        </div>
        <p class="org-card-summary">${summary}</p>
        <div class="org-card-meta">
          <span>审核员 ${Number(item.reviewer_count || 0)}</span>
          <span>员工 ${Number(item.employee_count || 0)}</span>
        </div>
        <div class="org-card-actions">${actionButton(item)}</div>
      </article>
    `;
  }

  // onChange(hasCustomOrganization) 供页面据此开关工作区入口
  async function load(options) {
    const lobbyBox = document.querySelector(options.lobbySelector);
    const directoryBox = document.querySelector(options.directorySelector);
    const messageBox = document.querySelector(options.messageSelector);
    if (messageBox) messageBox.textContent = '';

    try {
      const content = await API.lobbyContent();
      renderLobbyContent(lobbyBox, content);
    } catch (error) {
      lobbyBox.innerHTML = `<p class="muted">${escapeHtml(briefError(error))}</p>`;
    }

    try {
      const data = await API.organizationsDirectory();
      const items = Array.isArray(data.organizations) ? data.organizations : [];
      directoryBox.innerHTML = items.length
        ? items.map(organizationCard).join('')
        : '<p class="muted">暂无可加入的组织，请联系开发者创建</p>';
      directoryBox.querySelectorAll('button[data-org-action]').forEach((button) => {
        button.addEventListener('click', () => submit(button, options));
      });
      if (typeof options.onChange === 'function') {
        // 回传已加入组织列表：页面据此开关工作区入口，并填充上传目标组织选择
        options.onChange(items.filter((item) => item.my_status === 'joined'));
      }
    } catch (error) {
      directoryBox.innerHTML = `<p class="muted">${escapeHtml(briefError(error))}</p>`;
    }
  }

  async function submit(button, options) {
    const id = button.dataset.orgId;
    const action = button.dataset.orgAction;
    const messageBox = document.querySelector(options.messageSelector);
    button.disabled = true;
    try {
      if (action === 'join') {
        await API.requestJoinOrganization(id);
      } else {
        await API.requestLeaveOrganization(id);
      }
      // 先重新加载再写提示：load() 会清空提示区，顺序反了成功文案会被立刻抹掉
      await load(options);
      if (messageBox) {
        messageBox.textContent = action === 'join' ? '加入申请已提交，等待审批' : '退出申请已提交，等待审批';
        messageBox.classList.add('success');
      }
    } catch (error) {
      if (messageBox) {
        messageBox.textContent = briefError(error);
        messageBox.classList.remove('success');
      }
      button.disabled = false;
    }
  }

  return { load };
})();
