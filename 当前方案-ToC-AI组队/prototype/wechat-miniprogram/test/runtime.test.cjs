const assert = require("node:assert/strict");
const test = require("node:test");
const { createRuntime } = require("../miniprogram/utils/runtime.js");

test("Agent requests can wait for the server's model timeout without slowing normal requests", async () => {
  const calls = [];
  const { api } = createRuntime({
    baseUrl: "https://api.cospan.cn",
    wxApi: {
      getStorageSync: () => "test-session",
      request(options) {
        calls.push(options);
        options.success({ statusCode: 200, data: {} });
      },
    },
  });
  await api.get("/api/me");
  await api.post("/api/tasks/task-1/agent-runs", {}, {
    timeout: 35000,
    headers: { "x-idempotency-key": "same-attempt" },
  });
  assert.equal(calls[0].timeout, 12000);
  assert.equal(calls[1].timeout, 35000);
  assert.equal(calls[1].header["x-idempotency-key"], "same-attempt");
});

test("timeout and offline failures remain distinguishable without leaking raw platform errors", async () => {
  for (const [message, code] of [["request:fail timeout", "REQUEST_TIMEOUT"], ["request:fail connection", "NETWORK_ERROR"],
    ["request:fail url not in domain list", "DOMAIN_NOT_ALLOWED"], ["request:fail ssl hand shake error", "TLS_ERROR"]]) {
    const { api } = createRuntime({ baseUrl: "https://api.cospan.cn", wxApi: {
      getStorageSync: () => "test-session",
      request: ({ fail }) => fail({ errMsg: message }),
    } });
    await assert.rejects(api.get("/api/me"), (error) => error.code === code && !error.message.includes("request:fail"));
  }
});

test("request timeouts stay bounded", async () => {
  const calls = [];
  const { api } = createRuntime({ baseUrl: "https://api.cospan.cn", wxApi: {
    getStorageSync: () => "test-session",
    request(options) { calls.push(options.timeout); options.success({ statusCode: 200, data: {} }); },
  } });
  await api.get("/api/me", {}, { timeout: Infinity });
  await api.get("/api/me", {}, { timeout: 90000 });
  await api.get("/api/me", {}, { timeout: -1 });
  assert.deepEqual(calls, [12000, 60000, 1000]);
});
