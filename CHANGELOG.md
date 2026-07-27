# 知天管理后台改动记录
> Codex每次完成管理后台改动后必须追加到此文件

## 2026-07-19 系统提示词模块编辑
- reviewer开发者视图新增规范、语气风格和禁用三个模块编辑区，复用JWT调用后端统一读取/保存接口；保存后从下一次模型请求生效。
- 模块默认改为只读，需点击“修改模块”后编辑；保存时提供取消、放弃和确定三种操作。移除已停用供应商的“GLM错误”历史指标卡，仅保留DeepSeek错误统计。

## 2026-07-12
- 审核员页新增开发者视图切换和手动刷新按钮，复用 reviewer JWT 调用 `GET /reviewer/metrics`，展示进程内请求、模型调用、搜索降级和错误分类统计，以及统计起始时间。

## 2026-07-13
- 开发者视图改为与审核工作台互斥，切换后隐藏待审核文档、文档管理、检索调试和记忆总览；新增 recent_requests 的阶段耗时分布、trace_id 明细查询和原生 SVG 请求耗时趋势展示。

## 2026-07-02
- 新建静态网页管理后台，包含登录页、员工页、审核员页和入口跳转页
- 登录页支持employee/reviewer分流，customer账号拦截并提示使用桌面端应用
- 员工页支持上传文档、直接录入文字知识，并查看文档列表
- 审核员页支持待审核文档批准/拒绝、文档总览删除和记忆统计查看
- 所有后端请求统一通过js/api.js携带Authorization Bearer token，并处理401回登录页
- 员工页文档列表新增审核状态和撤销操作，pending且由当前员工上传的文档可撤销
- 审核员待审核列表新增预览按钮，可在当前页查看文档全部chunk内容后再批准或拒绝
- 审核员页“已确权文档总览”改名为“文档管理”，避免误导为只展示已通过文档
- 管理后台样式统一为简约风格：浅灰背景、白色卡片、无阴影、#1A73E8主按钮、#D32F2F危险按钮和浅灰表头
- 2026-07-03：回退审核员知识库内容查看和危险操作区，移除管理员密码二次确认清空入口，管理后台恢复为文档审核、文档管理和记忆统计查看。
- 2026-07-03：审核员页文档管理列表新增预览按钮，可查看已上传文档在Chroma中的chunk内容。
- 2026-07-03：审核员页文档管理改为调用GET /documents/verified，仅展示已审核通过文档，列表列调整为文件名、chunk数量、上传者、审核时间和操作。
- 2026-07-03：员工页上传文档从填写服务器文件路径改为浏览器选择本地文件上传，适配公网/局域网部署。
- 2026-07-05：审核员页新增“检索调试”区域，可输入query和top_k调用POST /debug/retrieve，展示verified企业文档候选source/doc_id/chunk_index/score。
- 2026-07-05：检索调试结果按score降序展示，并按RAG_SCORE_THRESHOLD区分达标/未达标候选；该入口仅reviewer页面可见，不提供用户个人记忆查看能力。

## 2026-07-05
- 审核员页“检索调试”新增“包含待审核文档”开关，默认关闭；开启后可查看pending企业文档候选，结果表格新增状态列展示verified/pending。
- 检索调试表格继续按score降序展示，并保留RAG_SCORE_THRESHOLD达标/未达标区分；rejected文档不会展示，且该入口不涉及用户个人记忆。

## 2026-07-14
- 员工上传文件选择器新增`.doc/.xls/.xlsx/.ppt/.pptx`，选择转换格式时提示将由后端自动转换后上传，继续复用现有上传和审核流程。
- 审核员待审核文档和已通过文档列表在`converted_from`非空时展示转换来源文件名。

## 2026-07-18
- 依据后端 Bronze Intelligence 模板统一重做登录、员工和审核员页面，采用固定侧栏、暖铜设计令牌、分层工作区与窄屏单列布局。
- 保留现有 JWT、上传、审核、检索调试和开发者指标的 DOM/API 契约，仅调整展示结构与样式；JavaScript 语法、关键 DOM ID 和桌面/窄屏布局验证通过。

## 2026-07-19 检索调试展示标题加分来源
- 审核员检索调试表新增`VECTOR分数`与`标题加分`两列，SCORE统一展示后端`final_score`，可直接区分自然语义分与title/source保证分。
- 空态、加载态和错误态同步适配7列表格，不改变现有检索请求、审核权限和候选排序交互。
## 2026-07-22 系统提示词编辑增加二级密码闸门
- 开发者指标仍对reviewer展示，系统提示词编辑器默认隐藏；通过二级密码验证后才显示编辑区，保存请求携带`X-Secondary-Password`。
- 二级密码仅保存在当前页面内存，不写入localStorage；验证失败、保存完成/失败或退出开发者视图后立即清除并重新锁定编辑区。
## 2026-07-22 迁移系统模块至developer权限
- 管理后台允许developer登录审核工作台，但仅展示系统提示词模块区域；reviewer继续使用审核与可观测性页面且不再看到模块编辑入口。
- 系统模块请求迁移至`/developer/system-modules`，移除二级密码输入、验证端点和`X-Secondary-Password`请求头，保留“修改模块→保存确认”交互。
- `node --check`验证`api.js`、`reviewer.js`和`login.js`语法通过。

## 2026-07-23 验收仓库归拢迁移
- 管理后台仓库迁移至`D:\zhiliao\zhitian\zhitian_admin\`，独立`.git`历史与当前工作区状态均保持完整；源码未发现旧项目绝对路径引用。

## 2026-07-23 完成账号治理Batch 5管理后台接入
- `developer.html`将注册审批拆分为开发者/审核员两张子表，账号治理替换为四角色人数快照和仅含developer/reviewer的人员详情；支持特别关注切换与备注持久化，不再展示启停、改角色和重置密码操作。
- developer与reviewer工作台均新增最近20条密码重置事件展示；reviewer侧边栏将“员工账号审批”调整到“待审核”之前，系统模块和可观测性区域保持原有行为。
- 新增公开`forgot-password.html`，通过邮箱和企业密码调用既有重置接口；成功仅展示一次新密码，错误企业密码与不存在邮箱在页面统一显示相同提示，登录页新增入口。
- 6个管理后台JavaScript文件通过`node --check`；真实HTTP与浏览器验证完成，人数/人员/重置事件正常加载，关注和备注刷新后持久化，忘记密码生成的12位新密码可用于登录，临时测试账号与事件已清理。

## 2026-07-24 展示当前企业密码
- `developer.html`在人员概览统计附近新增常驻企业密码卡片，`reviewer.html`新增同等展示区域；两页加载后自动调用各自只读接口并显示下次凌晨4点刷新时间。
- API调用仍沿用JWT角色权限；请求失败仅显示加载错误，不在浏览器本地持久化企业密码。
- `api.js`、`developer.js`、`reviewer.js`均通过`node --check`。

## 2026-07-24 展示外网搜索输出观察指标
- developer可观测性卡片新增输出校验总数、异常标记数和校验失败数，读取既有`/reviewer/metrics`响应，不展示任何用户问题、候选或回复内容。

## 2026-07-24 诊断人数统计与0全面审查排版旧文本
- **A部分诊断**：`developer.html`人员概览卡片开发者/审核员显示为0、但下方详情表仍列出`username=0`（developer）与`username=1`（reviewer）两个默认引导账号，核实后端`layers/headcount_snapshot.py::get_or_create_today_snapshot()`的SQL明确为`WHERE is_active = 1 AND is_default_account = 0`——确认是既有设计（真实人数统计不应把引导用占位账号计入），不是查询条件写反或统计口径bug；而`auth.list_personnel_detail()`按设计展示全部developer/reviewer账号（含默认账号），两个查询口径本身均正确，只是缺少说明导致数字与列表显得矛盾。
- 修复：`developer.html`在`headcountGrid`和详情表之间新增说明文字“人数统计不含默认引导账号（用户名0/1/2/3），下方详情列表展示全部开发者/审核员账号（含默认引导账号）”，不改动任何后端统计逻辑。
- **B部分审查**：逐页检查`developer.html`、`reviewer.html`、`login.html`、`employee.html`、`forgot-password.html`、`request-access.html`及`index.html`，发现并直接修复以下低风险问题：
  1. `login.html`页脚版本号停留在`v1.9`，仓库已打`v2.1`标签，更新为`知天 Agent Platform · v2.1`；`README.md`的release徽章同步从`v1.9`更新为`v2.1`。
  2. `css/style.css`第80行`.module-editor-grid label`使用了未在`:root`中定义的设计令牌`--text-secondary`（全局唯一引用处），与项目既有的`--muted`令牌用途重复，统一改为`var(--muted)`。
  3. `reviewer.html`侧边栏导航顺序（员工账号审批→待审核→文档管理→检索调试→记忆总览→密码重置记录）与页面实际DOM顺序（员工账号审批→**密码重置记录**→待审核→文档管理→检索调试→记忆总览）不一致，`密码重置记录`区块在Batch 5改动中被插入到第二位但导航锚点顺序未同步调整；已将导航链接顺序调整为与DOM顺序一致。
- 审查未发现死代码、隐藏元素残留或过时角色/流程措辞；`employee.html`、`forgot-password.html`、`request-access.html`、`index.html`未发现明显排版或文案问题，未做改动。`login.html`角色说明区（`role-note`）仅展示员工/审核员两类角色说明、未提及开发者角色，属于登录页有意不对外展示开发者身份的设计取向，本轮判断为设计选择而非缺陷，未修改，如需调整请指挥师确认。
- 验证：管理后台全部7个JavaScript文件`node --check`通过；真实启动后端并在浏览器中登录developer账号验证——`headcountGrid`显示开发者=0/审核员=0/员工=1/客户=1，紧邻说明文字与下方详情表（含`username=0/1`两条默认账号记录）逻辑自洽；`reviewer.html`导航链接顺序确认已与DOM区块顺序一致。验证完成后已停止无reload后端进程，8000端口确认无残留监听。

## 2026-07-24 系统模块空状态占位提示与登录页布局调整
- `developer.html`系统提示词模块三个文本框新增原生`placeholder`属性：规范模块“例：回答需引用具体法律条款出处，不确定时明确说明”、语气风格模块“例：专业严谨，避免口语化表达”、禁用模块“例：不得提供医疗诊断建议，不得讨论政治敏感话题”；内容为空时显示灰色占位提示，已保存内容不受影响，未新增任何JS逻辑。
- `login.html`顶部图标、标题、副标题改为居中对齐：新增`login-brand`/`login-heading`两个仅作用于登录页的CSS类（`margin:0 auto`/`text-align:center`），未改动`request-access.html`/`forgot-password.html`共用的`.brand-mark`/`.auth-heading`基础样式。
- 登录按钮下方的“申请企业角色账号”“忘记密码”两个链接由同行居中+点分隔，改为新增`.auth-link-split`（`display:flex; justify-content:space-between`）分列左右两侧，移除中间的“·”分隔符；表单输入框布局和登录逻辑未改动。
- `node --check`确认7个JavaScript文件均未受影响（本轮只改HTML/CSS）；真实浏览器验证：系统模块三个文本框在空状态下正确显示对应占位文字，登录页图标/标题/副标题居中显示，两个链接分列登录按钮下方左右两侧。

## 2026-07-24 登录角色选择器改造、密码重置区域移除、人员详情拆分与trace_id可复制
- **item 1**：`login.html`账号类型由下拉`<select>`改为三按钮单选组（`.role-toggle`），隐藏`<input type="hidden" id="role">`保持`login.js`原有`roleInput.value`读取逻辑完全不变；选中态通过`.active`类切换背景色，同一时刻仅一个按钮激活。
- **item 3**：`developer.html`和`reviewer.html`均移除"最近密码重置"展示区域（含导航链接、`passwordResetPanel`区块）及对应JS加载逻辑（`loadPasswordResetEvents`及其事件绑定）；`api.js`同步移除已无调用方的`developerPasswordResetEvents`/`reviewerPasswordResetEvents`包装函数。后端`password_reset_log`表、写入逻辑及`GET /developer(reviewer)/password-reset-events`接口本身均未删除，仍可直接调用。
- **item 4**：`developer.html`原"开发者与审核员详情"合并表格拆分为"开发者详情"和"审核员详情"两张独立表格（各自6列，移除不再需要的"角色"列）；`developer.js`的`loadPersonnelOverview`按`role`字段过滤为`developers`/`reviewers`两个数组分别渲染，后端`GET /developer/personnel-detail`接口未改动。
- **item 5**：备注列交互改为点击展开：默认显示纯文本（或"暂无备注"占位）+"编辑"按钮；点击"编辑"切换为文本框+"保存"按钮；保存成功后调用`PATCH /developer/users/{user_id}/notes`并切回展示态，失败则保留编辑态并在共享状态区提示错误。移除旧版常驻输入框`.notes-control`样式，新增`.notes-view`/`.notes-edit`。
- **item 6**：`developer.html`"请求耗时趋势"表新增`trace_id`列（数据来自既有`recent_requests`结构，无需后端改动），trace_id以等宽字体按钮形式展示；点击后调用`navigator.clipboard.writeText`（不支持时降级为`execCommand('copy')`）复制完整trace_id，按钮文案短暂切换为"已复制"，1.2秒后恢复。
- 验证：管理后台全部7个JavaScript文件`node --check`通过。真实浏览器验证：三按钮选择器点击切换正确且提交行为不变；developer/reviewer两端企业密码卡片数值一致（见后端仓库CHANGELOG的手动刷新接口记录）；两页均确认"最近密码重置"区域已移除；开发者/审核员详情已拆分为两张独立表格且各自可正常加载、切换关注和备注编辑；trace_id列渲染为可点击按钮，真实点击后内部执行链路完整跑通（`navigator.clipboard.writeText`成功resolve、文案切到"已复制"、1.2秒后恢复），验证期间产生的测试会话和企业密码手动刷新计数已清理，真实数据库企业密码恢复为验证前的原值。

## 2026-07-24 组织管理界面与注册页布局统一
- `developer.html`新增"组织管理"区域（含侧边栏导航项）：表格列出全部组织的名称、内容描述、成员数，"默认"组织标注`受保护`徽章且操作列只显示"默认组织不可修改"文案、不渲染重命名/删除按钮；自定义组织提供行内"编辑"（名称与内容切换为输入框）和"删除"（带二次确认，提示账号本身不受影响）；顶部提供"新建组织"表单。任一增删改成功后同时刷新组织列表和系统模块区域，使规范模块文本即时反映最新组织。
- `developer.html`系统模块区域的"规范模块"改为只读展示：标签更新为"规范模块（按组织自动生成，只读）"，textarea 加 `readonly` 且点击"修改模块"时不再解除其 `disabled`，仅语气风格与禁用模块进入可编辑态；`developer.js`的`moduleValues()`/`discardModules()`同步移除guidance字段，`saveSystemModules`不再提交guidance（后端已改为收到该字段即返回400）。
- `request-access.html`按登录页样式统一：顶部图标与标题复用`login-brand`/`login-heading`改为居中；"申请角色"由下拉`<select>`改为与登录页一致的三按钮单选组（`.role-toggle`，员工/审核员/开发者），隐藏`<input type="hidden" id="requestedRole">`保持`request-access.js`原有取值逻辑不变，提交成功后按钮高亮同步重置回默认的"员工"。
- 申请页不提供组织选择：此前实现过的组织多选复选框（含`publicOrganizations` API 包装与`.org-checkbox-*`样式）已按需求回退移除，所有通过审批的账号统一只关联"默认"组织。
- 验证：全部7个JavaScript文件`node --check`通过。真实浏览器验证：组织管理区域正确展示"默认（受保护，无操作按钮）/法律/财务"，通过表单新建"财务"后规范模块文本即时变为含"财务（发票报销、预算审批流程）"、点击删除后恢复为仅含"法律"；点击"修改模块"确认规范模块保持`disabled=true`而语气风格/禁用模块解锁；注册页标题居中、三按钮切换正确同步隐藏字段值且同一时刻仅一个按钮激活。

## 2026-07-24 注册申请页新增密码强度提示与预检
- `request-access.html`密码输入框下方新增提示文案"至少10位，需包含大小写字母和数字"，配套新增`.field-hint`样式（浅色小字，复用`--muted`令牌）。
- `request-access.js`新增`isStrongPassword()`并在提交前预检（长度≥10且含大写、小写、数字），不通过时直接give出同文案提示、不发起请求。该预检仅用于减少无效请求，后端`validate_password_strength`为唯一权威判断，前端预检失效不影响后端把关。
- 忘记密码页未改动：该流程由系统生成随机密码，不受此规则约束。
- 7个JavaScript文件`node --check`通过；浏览器确认提示文案正确渲染在密码框下方。后端两个注册端点的弱密码拒绝已在后端仓库通过真实HTTP验证（见后端CHANGELOG同日条目）。

## 2026-07-24 新增多身份快速切换
- `api.js`新增五个账号管理函数并导出：`getSavedAccounts()`（读`saved_accounts`，解析失败或非数组时返回空数组，并过滤字段不全的脏数据）、`addOrUpdateSavedAccount(username, role, token)`（按username+role去重，命中则更新token与savedAt）、`setActiveAccount(username, role)`、`removeSavedAccount(username, role)`、`getActiveAccount()`。`auth_token`/`user_role`/`username`三个原有字段继续表示"当前激活账号"，其他模块读取逻辑无需改动，保持向后兼容。
- 新增`js/account-switcher.js`共享组件，由`developer.html`/`reviewer.html`/`employee.html`三页引入：在"退出登录"按钮上方插入切换区域，显示"用户名 · 角色中文名"（developer→开发者、reviewer→审核员、employee→员工）；点击展开下拉列表，列出全部已存账号并对当前激活项加`.is-active`高亮；底部"+ 添加账号"跳转登录页且不清空`saved_accounts`；点击非激活账号调用`setActiveAccount()`并按role跳转对应页面；点击页面其他区域自动收起菜单。
- `login.js`登录成功后改为调用`addOrUpdateSavedAccount()`+`setActiveAccount()`（后者内部写入三个原有字段），并在页面加载时展示`sessionStorage.auth_notice`中的过期提示。
- `api.js`的401处理由"清空全部登录态"改为"仅失效当前激活账号"：调用`removeSavedAccount()`移除该条、暂存提示"该账号登录已过期，请重新登录"后跳转登录页，`saved_accounts`中其他账号不受影响。前端不做本地过期预判，仅在后端实际返回401时处理。
- 三页"退出登录"改为调用`AccountSwitcher.handleLogout()`：仅移除当前激活账号并清除原有字段；若列表仍有账号则激活第一个并跳转其角色页面，列表为空时才回登录页。
- `css/style.css`新增`.account-switcher*`与`.account-option*`样式（向上弹出菜单、激活项用`--primary-soft`高亮、超长用户名省略号截断）。
- 后端登录与权限逻辑零改动，三页原有业务逻辑与`ensureRole`权限校验均未变更。
- 验证：8个JavaScript文件`node --check`全部通过。真实浏览器验证（后端真实运行、同一邮箱的developer/reviewer/employee三个账号依次真实登录）：三者均出现在切换列表且当前项正确高亮；点击列表项切换后`user_role`与`auth_token`同步更新、解出的JWT角色为目标角色、直接调用developer专属接口返回200，全程未再输入密码；连续退出登录依次为developer→激活reviewer→激活employee→列表清空并清除token，每次仅移除当前一条；模拟401场景确认只清除失效账号、另一账号完整保留且提示文案正确暂存。测试账号与浏览器本地存储均已清理。

## 2026-07-25 新增邮箱发送量监控卡片
- `developer.html`在人员概览区新增"今日邮件发送"卡片，展示`X / 200`与所属业务日，并提供"刷新用量"按钮；与既有企业密码卡片一同包进新增的`.resource-cards`弹性容器，两张资源类信息卡片并排展示、窄屏自动换行。
- `js/api.js`新增`developerEmailUsage()`包装`GET /developer/email-usage-stats`；`js/developer.js`新增`loadEmailUsage()`，沿用企业密码卡片既有的加载/刷新模式（页面初始化时并入`Promise.all`一次性加载，失败时仅在本卡片内显示错误提示，不影响页面其他区域）。
- 该卡片仅developer可见：接口本身为`require_developer`，`reviewer.html`未引入相关DOM与逻辑，审核员工作台无任何变化。
- 8个JavaScript文件`node --check`通过；DOM契约核对确认`emailUsageValue`/`emailUsageDetail`/`refreshEmailUsage`三个id在HTML与JS两侧一一对应。
- 真实浏览器验证：后端真实运行、真实触发两次验证码发送后，卡片正确渲染为"今日邮件发送 2 / 200，业务日：2026-07-25"，位置紧邻企业密码卡片。

## 2026-07-25 申请/忘记密码页发送验证码前置企业密码
- 配合后端安全加固（`POST /auth/send-verification-code`新增必填`enterprise_password`，防"换邮箱批量刷验证码"耗尽DirectMail每日额度）：`js/api.js`的`sendVerificationCode(email, purpose, enterprisePassword)`新增第三个参数，请求体透传`enterprise_password`。
- `request-access.html`与`forgot-password.html`将企业密码输入框上移至邮箱验证码之前，并加`.field-hint`提示"发送验证码前需先填写"，使必填顺序在界面上自解释。
- `js/request-access.js`与`js/forgot-password.js`的发送按钮在邮箱格式预检之后新增企业密码非空预检：未填写时直接提示"请先填写企业密码"并return，不发起请求；企业密码错误时沿用既有`catch`展示后端返回的具体提示（`api.js`的`request()`已透传`data.detail`，后端返回403"企业密码错误"）。
- 两页提交表单本身的`enterprise_password`字段保持不变：发送与提交是两次独立校验，属纵深防御，前端不因发送时已验证而省略提交时的字段。
- 8个JavaScript文件`node --check`通过。后端侧真实HTTP验证：错误企业密码返回403`{"detail":"企业密码错误"}`且不消耗发送量统计，正确企业密码发送成功且`used_today`由2递增为3。浏览器端完整走一遍申请/忘记密码流程需从真实邮箱读取验证码，与"用户手动创建四个真实测试账号"合并进行。

## 2026-07-26 组织大厅、组织申请审批队列与大厅内容管理
- 新增共享模块`js/org-lobby.js`（`OrgLobby.load()`），employee.html与reviewer.html共用：上半部分渲染"默认"大厅的三段公司级静态信息（工具使用规则/企业公告/行业准则，只读），下半部分渲染组织目录卡片（名称、简介、审核员人数、员工人数、当前状态），状态为none显示"申请加入"、joined显示"申请退出"、pending显示"审批中"。目录不含"默认"组织——全员自动在内、不参与申请流程。
- employee.html：未加入任何自定义组织时显示门槛提示条并禁用上传/录入的全部输入与按钮、面板整体置灰，而不是让用户点击后才收到后端403；后端仍是唯一权威判断。
- reviewer.html：同样的门槛提示（仅作用于文档审核区，员工账号审批区不受影响）；新增"员工组织申请"审批队列，展示本人所属组织内员工发起的加入/退出申请并提供批准/拒绝。
- developer.html：新增"审核员组织申请"队列（含全部审核员申请，以及组织暂无审核员时员工申请的冷启动兜底条目，带"冷启动兜底"标记）；新增"大厅内容管理"编辑区，三个文本框对应tool_rules/announcements/industry_standards，沿用系统提示词模块"修改—保存"的交互风格。
- `js/api.js`新增10个接口封装；`css/style.css`新增`.lobby-grid/.lobby-block/.org-grid/.org-card*/.gate-notice/.panel-locked`等样式，沿用既有色板与圆角令牌。
- 修复浏览器验证中暴露的真实缺陷：申请提交与审批成功的提示文案被紧随其后的列表刷新清空（`load()`开头会清空提示区），三处均改为**先刷新再写提示**。
- 排查记录（通用教训）：验证期间一度出现"代码已改但页面行为不变"，先比对磁盘与HTTP服务器实际返回确认改动已落地，最终确认是预览面板缓存旧脚本；换用同样在CORS白名单内的另一来源（`127.0.0.1:8080`）后新代码立即生效。遇到行为与代码对不上时优先怀疑缓存，不要先怀疑代码逻辑。
- 9个JavaScript文件`node --check`通过。

## 2026-07-26 上传目标组织选择与审核列表组织范围提示
- employee.html上传与文字录入区新增归属组织字段：已加入1个组织时渲染只读提示"将上传至：法律"并附隐藏字段；已加入多个组织时渲染下拉选择器。两种形态都会把`organization_id`显式提交给后端——后端不做自动推断，前端只负责预填。
- `js/api.js`：`uploadDocument(file, organizationId)`在FormData中追加`organization_id`，`inputKnowledge(title, content, organizationId)`在请求体中追加同名字段。
- `js/org-lobby.js`的`onChange`回调由"是否已加入组织"的布尔值改为回传**已加入组织列表**，employee页据此同时完成门槛开关与上传目标渲染，reviewer页取长度判断，避免两页各自再查一次目录接口。
- reviewer.html两个文档列表标题下新增说明："待审核文档"标注仅展示所属组织范围内的文档，"文档管理"额外说明客户端检索不受组织范围限制，避免审核员误以为知识库被裁剪。
- reviewer页门槛提示改为解释性文案（未加入组织时看不到任何文档），并把"文档管理"面板一并纳入置灰范围，此前只置灰了"待审核文档"。
- `css/style.css`新增`.org-target-field/.org-target-readonly/.org-target-select`样式。
- 9个JavaScript文件`node --check`通过。浏览器验证：单组织只读形态、多组织下拉形态均正确渲染，选中"财务"后真实上传，后端回查`organization_id`与所选组织一致。
