const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const filters = require("../miniprogram/utils/discovery-filters.js");
const people = [
  { user_id: "a", status: "未组队", role: "交互设计", skills: [], availability: "4 小时", evidence: ["作品"], distance: { band: "under_50m" } },
  { user_id: "b", status: "团队缺人", role: "AI 算法", skills: [], availability: "8h", platform_links: [{ url: "https://example.com" }], distance: { band: "under_200m" } },
  { user_id: "c", status: "已组队但可交流", role: "硬件", skills: [], availability: "" },
];
test("filter groups use OR within selections and AND across groups", () => {
  const input = { ...filters.defaults(), statuses: ["seeking", "recruiting"], roles: ["design", "ai"], minimumHours: 4, evidenceRequired: true };
  assert.deepEqual(filters.filterPeople(people, input).map(p => p.user_id), ["a", "b"]);
  assert.equal(filters.count(input), 4);
  assert.equal(filters.filterPeople(people, { ...input, minimumHours: 8 })[0].user_id, "b");
});
test("distance requires real bands, never substitutes event membership for geolocation", () => {
  assert.equal(filters.filterPeople(people, { ...filters.defaults(), distance: "nearby" }).length, 2);
  assert.equal(filters.filterPeople(people, { ...filters.defaults(), distance: "very_near" }).length, 1);
  assert.equal(filters.filterPeople([people[2]], { ...filters.defaults(), minimumHours: 2 }).length, 0);
});
test("draft copies do not mutate applied arrays", () => {
  const applied = filters.defaults();
  const draft = filters.copy(applied);
  draft.statuses.push("seeking");
  assert.deepEqual(applied.statuses, []);
});
test("sheet preserves Web's five sections, confirmed apply, cancel and scrollable content", () => {
  const wxml = fs.readFileSync(path.join(__dirname, "../miniprogram/pages/discover/discover.wxml"), "utf8");
  for (const label of ["筛选偏好", "协作状态", "需要的职能", "最低投入时间", "现场范围", "只看有公开项目的人"]) assert.ok(wxml.includes(label));
  assert.match(wxml, /bindtap="confirmFilters"/);
  assert.match(wxml, /filter-cancel" bindtap="closeFilters"/);
  assert.match(wxml, /filter-sheet-scroll" scroll-y/);
});
