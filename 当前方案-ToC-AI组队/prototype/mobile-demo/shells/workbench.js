/* Desktop presentation only. Commands are supplied by the shared domain layer. */
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const statusLabel = status => ({ PROPOSED: "待认领", ACCEPTED: "待开始", IN_PROGRESS: "进行中", BLOCKED: "已阻塞", DONE: "已完成" })[status] || status;
const icon = (name) => {
  const paths = {
    tasks: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="m8 9 1 1 2-2m2 1h3M8 14h8"/>',
    mine: '<path d="M5 8h14v12H5zM9 8V4h6v4M5 13h14m-9 0v3h4v-3"/>',
    outputs: '<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h5"/>',
    activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    members: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
    agent: '<rect x="4" y="6" width="16" height="14" rx="4"/><path d="M12 3v3m-4 5v3m8-3v3m-7 3h6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.tasks}</svg>`;
};

function taskRow(task, board = false) {
  return `<article class="wb-task ${board ? "wb-task-card" : ""}" ${task.live ? `data-live-task-id="${escape(task.id)}"` : ""}>
    <button class="wb-task-open" data-action="workbench-task" data-task-id="${escape(task.id)}" aria-label="查看任务：${escape(task.title)}">
      <span class="wb-status-dot" data-status="${escape(task.status)}"></span>
      <span class="wb-task-name"><small>${escape(task.reference)}</small><strong>${escape(task.title)}</strong></span>
      <span class="wb-mode">${escape(task.mode)}</span>
      <em>${escape(task.ownerLabel || "负责人")}：${escape(task.owner)}</em>
      <span class="wb-status" data-status="${escape(task.status)}">${escape(statusLabel(task.status))}</span>
    </button>
    <div class="wb-task-command">${task.actionHtml || (task.mine ? '<span>我负责</span>' : '')}</div>
  </article>`;
}

function empty(title, copy) {
  return `<div class="wb-empty"><span aria-hidden="true">${icon("tasks")}</span><h3>${title}</h3><p>${copy}</p></div>`;
}

function renderRuns(runs) {
  if (!runs.length) return empty("还没有 Agent 运行记录", "接入并执行后，运行状态和结果会出现在这里。不会模拟后台工作。");
  return `<div class="wb-runs">${runs.map(run => `<article><header><span>${icon("agent")}</span><div><h3>${escape(run.agent_kind === "PLANNER" ? "计划编排" : "调研简报")}</h3><p>${escape(run.model || "未记录模型")} · ${escape(run.status)}</p></div></header><p>${run.review_decision ? `审阅结论：${escape(run.review_decision)}` : "尚未记录人类审阅结论"}</p>${run.output ? `<details><summary>查看输出内容</summary><pre>${escape(typeof run.output === "string" ? run.output : JSON.stringify(run.output, null, 2))}</pre></details>` : '<p>暂无输出内容</p>'}</article>`).join("")}</div>`;
}

function renderDetail(task, model) {
  const runs = model.runs.filter(run => run.task_id === task.id);
  return `<aside class="wb-detail" aria-label="任务详情" tabindex="-1">
    <header><span>${escape(task.reference)} / 任务详情</span><button data-action="workbench-close" aria-label="关闭任务详情">×</button></header>
    <div class="wb-detail-body"><span class="wb-status" data-status="${escape(task.status)}">${escape(statusLabel(task.status))}</span><h2>${escape(task.title)}</h2>
      <dl><div><dt>${escape(task.ownerLabel || "负责人")}</dt><dd>${escape(task.owner)}</dd></div><div><dt>协作方式</dt><dd>${escape(task.mode)}</dd></div></dl>
      <section><h3>任务目标</h3><p>${escape(task.objective || "尚未补充任务目标")}</p></section>
      ${task.rationale ? `<section><h3>分工依据</h3><p>${escape(task.rationale)}</p></section>` : ""}
      <section><h3>验收标准</h3><p>${escape(task.acceptance || "尚未填写验收标准")}</p></section>
      ${task.risk ? `<section><h3>需要先确认</h3><p>${escape(task.risk)}</p></section>` : ""}
      <section><h3>Agent 与产物 <small>${runs.length}</small></h3>${runs.length ? renderRuns(runs) : '<p class="wb-muted">暂无关联运行或产物。Agent 辅助是一种协作方式，不表示已经执行。</p>'}</section>
      <section class="wb-detail-note">任务完成由负责人确认；Agent 的运行状态独立记录。</section>
    </div><footer>${task.actionHtml || '<span>当前没有可执行操作</span>'}</footer>
  </aside>`;
}

export function renderWorkbench(model, ui) {
  const sections = [["tasks", "项目任务"], ["mine", "我的待办"], ["outputs", "Agent 与产物"], ["activity", "项目动态"], ["members", "团队成员"]];
  const section = sections.some(([id]) => id === ui.section) ? ui.section : "tasks";
  const mine = model.tasks.filter(task => task.mine && task.status !== "DONE");
  const blocked = model.tasks.filter(task => task.status === "BLOCKED");
  const doing = model.tasks.filter(task => task.status === "IN_PROGRESS");
  const done = model.tasks.filter(task => task.status === "DONE");
  const selected = model.tasks.find(task => task.id === ui.taskId);
  let tasks = section === "mine" ? mine : model.tasks;
  if (ui.filter === "blocked") tasks = tasks.filter(task => task.status === "BLOCKED");
  if (ui.filter === "active") tasks = tasks.filter(task => task.status !== "DONE");
  let content;
  if (section === "outputs") content = renderRuns(model.runs);
  else if (section === "activity") content = `<div class="wb-records">${model.activityHtml}</div>`;
  else if (section === "members") content = `<div class="wb-members"><h3>一起推进这个项目</h3>${model.membersHtml}<p class="wb-muted">成员本人接受任务；Agent 不替人承诺，也不自动改派负责人。</p></div>`;
  else if (!tasks.length) content = empty(section === "mine" ? "当前没有你的待办" : "这里暂时没有任务", ui.filter === "blocked" ? "当前筛选下没有阻塞事项。" : "领取分工建议，或等待团队生成计划。");
  else if (ui.layout === "board") {
    const columns = [["todo", "待开始", ["PROPOSED", "ACCEPTED"]], ["doing", "进行中", ["IN_PROGRESS"]], ["blocked", "已阻塞", ["BLOCKED"]], ["done", "已完成", ["DONE"]]];
    content = `<div class="wb-board">${columns.map(([id, label, statuses]) => { const items = tasks.filter(task => statuses.includes(task.status)); return `<section class="wb-column"><h3><i data-column="${id}"></i>${label}<span>${items.length}</span></h3>${items.map(task => taskRow(task, true)).join("") || '<p class="wb-column-empty">暂无任务</p>'}</section>`; }).join("")}</div>`;
  } else content = `<div class="wb-task-table"><div class="wb-table-heading"><span>任务</span><span>协作方式</span><span>负责人</span><span>状态 / 操作</span></div>${tasks.map(task => taskRow(task)).join("")}</div>`;
  const isTasks = section === "tasks" || section === "mine";
  return `<section class="workspace-desktop-grid wb-workspace ${selected ? "has-detail" : ""}" aria-label="桌面协作工作台">
    <main class="wb-main"><header class="wb-project-header"><div><p>工作空间 <span>/</span> ${escape(model.live ? "我的项目" : "示例项目")}</p><h1>${escape(model.title)}</h1><p>${escape(model.summary)}</p></div><span class="wb-version">${escape(model.version)}</span></header>
      ${model.errorHtml || ""}
      <div class="wb-focus-strip"><button data-action="workbench-section" data-section="mine"><span>我的待办</span><strong>${mine.length}<small>项</small></strong></button><button data-action="workbench-blocked"><span>需要解除的阻塞</span><strong>${blocked.length}<small>项</small></strong></button><div><span>团队进行中</span><strong>${doing.length}<small>项</small></strong></div><div><span>已完成</span><strong>${done.length}<small>/ ${model.tasks.length}</small></strong></div></div>
      <div class="wb-plan-bar">${model.planHtml}</div>
      <nav class="wb-project-tabs" aria-label="项目内容">${sections.filter(([id]) => id !== "mine").map(([id, label]) => `<button data-action="workbench-section" data-section="${id}" ${id === section ? 'aria-current="page"' : ""}>${label}</button>`).join("")}</nav>
      <header class="wb-content-header"><div><h2>${sections.find(([id]) => id === section)[1]}</h2><p>${isTasks ? "围绕交付推进，点击任务展开上下文" : "只展示当前项目已有的记录"}</p></div>${isTasks ? `<div class="wb-layout-switch" aria-label="任务视图"><button data-action="workbench-layout" data-layout="list" aria-pressed="${ui.layout !== "board"}">列表</button><button data-action="workbench-layout" data-layout="board" aria-pressed="${ui.layout === "board"}">看板</button></div>` : ""}</header>
      ${isTasks ? `<nav class="wb-filters" aria-label="任务筛选">${[["all", "全部"], ["active", "未完成"], ["blocked", "已阻塞"]].map(([id, label]) => `<button data-action="workbench-filter" data-filter="${id}" aria-pressed="${ui.filter === id}">${label}</button>`).join("")}</nav>` : ""}
      ${content}
      <div class="wb-bottom-note">${icon("agent")}<span>人负责判断与交付，Agent 辅助执行。</span><span>${model.live ? "专业开发继续在已有工具完成" : "外部开发工具尚未接入"}</span></div>
    </main>${selected ? renderDetail(selected, model) : ""}
  </section>`;
}
