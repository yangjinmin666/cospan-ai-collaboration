const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const test = require("node:test");
const vm = require("node:vm");

const filename = path.resolve(__dirname, "../miniprogram/pages/room/room.js");
function roomFixture(overrides = {}) {
  return {
    project: { id: "project-1", originator_id: "owner" },
    members: [{ user_id: "owner", display_name: "负责人" }],
    starter_pack: { status: "CONFIRMED", generated_by: "TEMPLATE_FALLBACK" },
    confirmation_progress: { confirmed: 1, required: 1 },
    tasks: [{ id: "task-1", title: "用户调研", confirmed_owner_id: "owner", status: "ACCEPTED", mode: "HUMAN_AGENT" }],
    agent_runs: [],
    ...overrides,
  };
}
function harness({ room = roomFixture(), userId = "owner", get, post } = {}) {
  let definition;
  const calls = [];
  const toasts = [];
  const stored = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const app = { globalData: {
    user: { id: userId },
    storage: { get: (key) => stored.get(key), set: (key, value) => stored.set(key, value), remove: (key) => stored.delete(key) },
    api: {
      get: get || (async () => structuredClone(room)),
      post: async (...args) => { calls.push(args); return post ? post(...args) : {}; },
      patch: async (...args) => { calls.push(args); return {}; },
    },
  } };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    Page: (page) => { definition = page; },
    require: createRequire(filename),
    getApp: () => app,
    wx: { showToast: (toast) => toasts.push(toast), showModal: ({ success }) => success({ confirm: true }) },
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  }, { filename });
  const page = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
  page.onLoad({ projectId: "project-1" });
  return { page, calls, toasts, stored, app, room, timers };
}
const taskEvent = { currentTarget: { dataset: { taskId: "task-1" } } };

test("only the confirmed owner can request a brief after the shared plan is confirmed", async () => {
  const owner = harness();
  await owner.page.load();
  assert.equal(owner.page.data.room.tasks[0].canRunAgent, true);
  assert.match(owner.page.data.room.planSourceLabel, /模板/);
  for (const options of [
    { userId: "observer" },
    { room: roomFixture({ starter_pack: { status: "DRAFT" } }) },
    { room: roomFixture({ tasks: [{ id: "task-1", confirmed_owner_id: "owner", status: "COMPLETED", mode: "HUMAN_AGENT" }] }) },
    { room: roomFixture({ agent_runs: [{ id: "run-1", task_id: "task-1", status: "REVIEW_PENDING" }] }) },
  ]) {
    const context = harness(options);
    await context.page.load();
    assert.equal(context.page.data.room.tasks[0].canRunAgent, false);
  }
});

test("an ambiguous timeout reuses the persisted attempt, then presents the brief for human review", async () => {
  let count = 0;
  const context = harness({ post: async () => {
    count += 1;
    if (count === 1) throw Object.assign(new Error("timeout"), { code: "REQUEST_TIMEOUT" });
    const run = { id: "run-1", task_id: "task-1", status: "REVIEW_PENDING", output: {
      brief_md: "建议先验证需求", risks: ["样本量不足"], next_steps: ["访谈参与者"], key_terms: ["原型"],
    } };
    context.room.agent_runs = [run];
    return { agent_run: run };
  } });
  await context.page.load();
  await context.page.requestAgent(taskEvent);
  assert.match(context.page.data.actionError, /服务端可能仍在生成/);
  assert.equal(context.stored.size, 1);
  await context.page.requestAgent(taskEvent);
  assert.equal(context.calls[0][0], "/api/tasks/task-1/agent-runs");
  assert.equal(context.calls[0][2].timeout, 35000);
  assert.equal(context.calls[0][2].headers["x-idempotency-key"], context.calls[1][2].headers["x-idempotency-key"]);
  assert.equal(context.stored.size, 0);
  const run = context.page.data.room.tasks[0].agentRuns[0];
  assert.equal(run.canReview, true);
  assert.equal(run.output.brief_md, "建议先验证需求");
  assert.equal(context.page.data.room.tasks[0].canRunAgent, false);
  assert.equal(context.page.data.working, false);
});

test("an HTTP success containing a FAILED run is shown as failure, never generated successfully", async () => {
  const context = harness({ post: async () => ({ agent_run: { status: "FAILED", error_code: "LLM_TIMEOUT" } }) });
  await context.page.load();
  await context.page.requestAgent(taskEvent);
  assert.match(context.page.data.actionError, /AI 生成超时/);
  assert.equal(context.toasts.some((toast) => toast.title === "简报已生成，待你确认"), false);
  assert.equal(context.stored.size, 0);
});

test("an unconfigured model gives an actionable explanation instead of a fake brief", async () => {
  const context = harness({ post: async () => { throw { code: "AGENT_UNAVAILABLE" }; } });
  await context.page.load();
  await context.page.requestAgent(taskEvent);
  assert.match(context.page.data.actionError, /尚未配置 AI/);
  assert.equal(context.page.data.room.tasks[0].agentRuns.length, 0);
});

test("double taps start only one request", async () => {
  let resolveRun;
  const context = harness({ post: () => new Promise((resolve) => { resolveRun = resolve; }) });
  await context.page.load();
  const first = context.page.requestAgent(taskEvent);
  await context.page.requestAgent(taskEvent);
  assert.equal(context.calls.length, 1);
  resolveRun({ agent_run: { status: "REVIEW_PENDING" } });
  await first;
});

test("owner approval reviews the brief without completing the task; others cannot approve", async () => {
  const room = roomFixture({ agent_runs: [{ id: "run-1", task_id: "task-1", status: "REVIEW_PENDING" }] });
  const event = { currentTarget: { dataset: { runId: "run-1", decision: "APPROVED" } } };
  const context = harness({ room });
  await context.page.load();
  await context.page.reviewAgent(event);
  assert.equal(context.calls.length, 1);
  assert.equal(context.calls[0][0], "/api/agent-runs/run-1/review");
  assert.equal(context.calls[0][1].decision, "APPROVED");
  assert.equal(context.page.data.room.tasks[0].status, "ACCEPTED");
  const observer = harness({ room, userId: "observer" });
  await observer.page.load();
  await observer.page.reviewAgent(event);
  assert.equal(observer.calls.length, 0);
});

test("only the trigger or project originator can cancel a running brief", async () => {
  const room = roomFixture({ agent_runs: [{ id: "run-1", task_id: "task-1", status: "RUNNING", triggered_by: "trigger" }] });
  const event = { currentTarget: { dataset: { runId: "run-1" } } };
  for (const userId of ["owner", "trigger", "observer"]) {
    const context = harness({ room, userId });
    await context.page.load();
    await context.page.cancelAgent(event);
    assert.equal(context.calls.length, userId === "observer" ? 0 : 1);
  }
});

test("room loading failures expose a retry state instead of a blank page", async () => {
  let attempts = 0;
  const context = harness({ get: async () => {
    if (++attempts === 1) throw new Error("无法连接 COSPAN 服务，请检查网络");
    return roomFixture();
  } });
  assert.equal(await context.page.load(), false);
  assert.match(context.page.data.loadError, /无法连接/);
  assert.equal(context.page.data.loading, false);
  assert.equal(await context.page.load(), true);
  assert.equal(context.page.data.loadError, "");
  assert.equal(context.page.data.room.project.id, "project-1");
});

test("leaving the page cancels automatic refresh", async () => {
  const context = harness({ room: roomFixture({ agent_runs: [{ id: "run-1", task_id: "task-1", status: "RUNNING" }] }) });
  await context.page.onShow();
  assert.equal(context.timers.size, 1);
  context.page.onHide();
  assert.equal(context.timers.size, 0);
});
