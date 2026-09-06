import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("human-confirmed COSPAN Space starter pack", () => {
  let api;
  let baseUrl;

  const headers = (userId, extra = {}) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
    ...extra,
  });

  beforeEach(async () => {
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => new Date("2026-08-29T07:00:00.000Z"),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function createTeam() {
    const requested = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
      }),
    });
    const request = (await requested.json()).request;
    await fetch(`${baseUrl}/api/connections/requests/${request.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    const projectResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        event_id: "hackathon-2026",
        title: "离线会议洞察终端",
        summary: "把线下讨论自动沉淀为可执行任务",
        role_need: { title: "技术构建者", skills: ["工程实现"], capacity: 2 },
      }),
    });
    const project = await projectResponse.json();
    const invited = await fetch(`${baseUrl}/api/projects/${project.project.id}/invitations`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        invitee_id: "user-lin",
        role_need_id: project.role_needs[0].id,
      }),
    });
    const invitation = (await invited.json()).invitation;
    await fetch(`${baseUrl}/api/team-invitations/${invitation.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    return {
      projectId: project.project.id,
      roleNeedId: project.role_needs[0].id,
    };
  }

  test("members add tasks across surfaces, re-confirm the plan, and recover blocked or completed work", async () => {
    const { projectId } = await createTeam();
    const request = async (path, user, body, surface = "mobile", method = "POST") => {
      const response = await fetch(`${baseUrl}${path}`, { method, headers: headers(user, { "x-cospan-surface": surface }),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    };
    await request(`/api/projects/${projectId}/starter-pack`, "user-zhou", {});
    for (const user of ["user-zhou", "user-lin"]) await request(`/api/projects/${projectId}/plan-confirmations`, user, {});
    const payload = { title: "跨端同步验收", objective: "手机创建，电脑推进", acceptance_criteria: "刷新后两端任务一致",
      mode: "HUMAN", suggested_owner_id: "user-lin", client_request_id: "mobile-task-0001" };
    assert.equal((await request(`/api/projects/${projectId}/tasks`, "user-su", payload)).status, 403);
    assert.equal((await request(`/api/projects/${projectId}/tasks`, "user-zhou", { ...payload, suggested_owner_id: "user-su" })).status, 400);
    const created = await request(`/api/projects/${projectId}/tasks`, "user-zhou", payload);
    assert.equal(created.status, 201);
    assert.equal(created.body.task.confirmed_owner_id, null, "suggesting a teammate never assigns them without consent");
    assert.equal(created.body.starter_pack.version, 2);
    assert.equal(created.body.starter_pack.status, "PROPOSED");
    const replay = await request(`/api/projects/${projectId}/tasks`, "user-zhou", payload);
    assert.equal(replay.body.task.id, created.body.task.id);
    assert.equal(replay.body.idempotent_replay, true);
    assert.equal((await request(`/api/projects/${projectId}/tasks`, "user-zhou", { ...payload, title: "changed" })).status, 409);
    const taskPath = `/api/tasks/${created.body.task.id}`;
    const move = (user, action) => request(taskPath, user, { action }, "desktop", "PATCH");
    await move("user-lin", "claim");
    assert.equal((await move("user-lin", "start")).status, 409);
    for (const user of ["user-zhou", "user-lin"]) await request(`/api/projects/${projectId}/plan-confirmations`, user, {});
    assert.equal((await move("user-lin", "start")).body.task.status, "IN_PROGRESS");
    assert.equal((await move("user-lin", "block")).body.task.status, "BLOCKED");
    assert.equal((await move("user-zhou", "resume")).status, 403);
    assert.equal((await move("user-lin", "complete")).status, 409);
    assert.equal((await move("user-lin", "resume")).body.task.status, "IN_PROGRESS");
    assert.equal((await move("user-lin", "complete")).body.task.status, "DONE");
    assert.equal((await move("user-lin", "reopen")).body.task.status, "IN_PROGRESS");
    const recovered = (await request(`/api/projects/${projectId}/room`, "user-zhou", undefined, "mobile", "GET")).body;
    assert.equal(recovered.tasks.length, 4);
    assert.equal(recovered.tasks.find((task) => task.id === created.body.task.id).status, "IN_PROGRESS");
    for (const event of ["task_created", "task_resumed", "task_reopened"]) assert.ok(recovered.activity.some((item) => item.event_type === event));
    assert.ok(recovered.activity.some((item) => item.event_type === "task_resumed" && item.source === "desktop"));
  });

  test("Agent suggestions stay proposals until people claim tasks and all members confirm", async () => {
    const { projectId, roleNeedId } = await createTeam();
    const generated = await fetch(`${baseUrl}/api/projects/${projectId}/starter-pack`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({}),
    });
    const generatedBody = await generated.json();
    assert.equal(generated.status, 201);
    assert.equal(generatedBody.starter_pack.status, "PROPOSED");
    assert.equal(generatedBody.starter_pack.generated_by, "TEMPLATE_FALLBACK");
    assert.equal(generatedBody.tasks.length, 3);
    assert.equal(generatedBody.tasks.every((task) => task.confirmed_owner_id === null), true);

    const preferredTask = generatedBody.tasks[2];
    const claimed = await fetch(`${baseUrl}/api/tasks/${preferredTask.id}`, {
      method: "PATCH",
      headers: headers("user-lin", { "x-cospan-surface": "desktop" }),
      body: JSON.stringify({ action: "claim" }),
    });
    const claimedBody = await claimed.json();
    assert.equal(claimed.status, 200);
    assert.equal(claimedBody.task.confirmed_owner_id, "user-lin");
    assert.equal(claimedBody.task.status, "ACCEPTED");

    const prematureStart = await fetch(`${baseUrl}/api/tasks/${preferredTask.id}`, {
      method: "PATCH",
      headers: headers("user-lin", { "x-cospan-surface": "desktop" }),
      body: JSON.stringify({ action: "start" }),
    });
    assert.equal(prematureStart.status, 409);
    assert.equal((await prematureStart.json()).error.code, "PLAN_NOT_CONFIRMED");

    const firstConfirmation = await fetch(
      `${baseUrl}/api/projects/${projectId}/plan-confirmations`,
      {
        method: "POST",
        headers: headers("user-zhou", { "x-cospan-surface": "desktop" }),
        body: "{}",
      },
    );
    const firstBody = await firstConfirmation.json();
    assert.equal(firstBody.starter_pack.status, "PROPOSED");
    assert.deepEqual(firstBody.confirmation_progress, { confirmed: 1, required: 2 });

    const finalConfirmation = await fetch(
      `${baseUrl}/api/projects/${projectId}/plan-confirmations`,
      {
        method: "POST",
        headers: headers("user-lin", { "x-cospan-surface": "mobile" }),
        body: "{}",
      },
    );
    const finalBody = await finalConfirmation.json();
    assert.equal(finalBody.starter_pack.status, "CONFIRMED");
    assert.deepEqual(finalBody.confirmation_progress, { confirmed: 2, required: 2 });

    const room = await fetch(`${baseUrl}/api/projects/${projectId}/room`, {
      headers: headers("user-lin"),
    });
    const roomBody = await room.json();
    assert.equal(room.status, 200);
    assert.equal(roomBody.starter_pack.status, "CONFIRMED");
    assert.equal(roomBody.tasks.find((task) => task.id === preferredTask.id).status, "ACCEPTED");
    assert.equal(roomBody.activity.some((item) => item.event_type === "task_claimed"), true);
    assert.equal(roomBody.activity.some((item) => item.event_type === "plan_confirmed"), true);
    assert.equal(roomBody.activity.some(
      (item) => item.event_type === "task_claimed" && item.source === "desktop"
    ), true);
    assert.equal(roomBody.activity.some(
      (item) => item.event_type === "plan_confirmation_recorded" && item.source === "desktop"
    ), true);
    assert.equal(roomBody.activity.some(
      (item) => item.event_type === "plan_confirmation_recorded" && item.source === "mobile"
    ), true);

    const started = await fetch(`${baseUrl}/api/tasks/${preferredTask.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "start" }),
    });
    assert.equal(started.status, 200);
    const reclaimed = await fetch(`${baseUrl}/api/tasks/${preferredTask.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "claim" }),
    });
    assert.equal(reclaimed.status, 409);
    assert.equal((await reclaimed.json()).error.code, "TASK_ALREADY_STARTED");

    const visibleSu = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({
        state: "VISIBLE",
        expires_at: "2026-08-29T23:00:00.000Z",
      }),
    });
    assert.equal(visibleSu.status, 200);
    const suRequest = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        recipient_id: "user-su",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    const suRequestId = (await suRequest.json()).request.id;
    assert.equal((await fetch(`${baseUrl}/api/connections/requests/${suRequestId}`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({ action: "accept" }),
    })).status, 200);
    const suInvitation = await fetch(`${baseUrl}/api/projects/${projectId}/invitations`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({ invitee_id: "user-su", role_need_id: roleNeedId }),
    });
    const suInvitationId = (await suInvitation.json()).invitation.id;
    assert.equal((await fetch(`${baseUrl}/api/team-invitations/${suInvitationId}`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({ action: "accept" }),
    })).status, 200);

    const reopenedRoom = await fetch(`${baseUrl}/api/projects/${projectId}/room`, {
      headers: headers("user-su"),
    });
    const reopenedBody = await reopenedRoom.json();
    assert.equal(reopenedBody.starter_pack.status, "PROPOSED");
    assert.deepEqual(reopenedBody.confirmation_progress, { confirmed: 0, required: 3 });
    assert.equal(reopenedBody.activity.some((item) => item.event_type === "plan_reopened_for_member"), true);
  });
});
