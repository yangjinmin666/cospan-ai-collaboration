const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const test = require("node:test");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "../miniprogram");
function pageHarness(name, sharedApp) {
  const filename = path.join(root, `pages/${name}/${name}.js`);
  let definition;
  const toasts = [];
  const navigation = [];
  const stored = new Map();
  const app = sharedApp || { globalData: { eventId: "event-1", storage: { get: (key) => stored.get(key), set: (key, value) => stored.set(key, value) } } };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    Page: (page) => { definition = page; }, require: createRequire(filename),
    getApp: () => app, wx: { showToast: (value) => toasts.push(value), showActionSheet: () => {},
      switchTab: (value) => navigation.push(value.url), pageScrollTo: (value) => navigation.push(value.selector),
      getLocation: ({ success }) => success({ latitude: 0, longitude: 0, accuracy: 10 }),
    },
    setTimeout, clearTimeout, setInterval, clearInterval,
  }, { filename });
  const tabBar = { data: { selected: 0, overlayOpen: false }, setData(data) { Object.assign(this.data, data); } };
  const page = { ...definition, data: structuredClone(definition.data), setData(data) { Object.assign(this.data, data); }, getTabBar() { return tabBar; } };
  const wxml = fs.readFileSync(path.join(root, `pages/${name}/${name}.wxml`), "utf8");
  const clickHandler = wxml.match(/<button[^>]*class="event-trigger(?: icon-button)?"[^>]*bindtap="([^"]+)"/)[1];
  return { page, app, tabBar, toasts, navigation, click: () => page[clickHandler](), wxml };
}

function componentHarness(overrides = {}) {
  let definition;
  const events = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, "components/scope-selector/index.js"), "utf8"), {
    Component: (value) => { definition = value; },
  });
  return {
    component: { ...definition.methods, data: {
      eventId: "event-1", events: [{ id: "event-1", name: "She Nicest 2026" }], ...overrides,
    }, triggerEvent: (name, detail) => events.push({ name, detail }) },
    events,
  };
}

test("filter changes stay in a draft until confirmed; cancel and reset do not change applied results", () => {
  const { page, tabBar } = pageHarness("discover");
  page.setData({ allPeople: [
    { user_id: "a", status: "未组队", role: "交互设计" },
    { user_id: "b", status: "团队缺人", role: "AI" },
  ] });
  page.applyFilters({ statuses: [], roles: [], minimumHours: 0, distance: "event", evidenceRequired: false });
  page.openFilters();
  assert.equal(tabBar.data.overlayOpen, true);
  page.toggleFilterChoice({ currentTarget: { dataset: { group: "statuses", value: "seeking" } } });
  assert.equal(page.data.filterPreviewCount, 1);
  assert.equal(page.data.people.length, 2);
  page.closeFilters();
  assert.equal(tabBar.data.overlayOpen, false);
  page.openFilters();
  assert.equal(page.data.filterDraft.statuses.length, 0);
  page.toggleFilterChoice({ currentTarget: { dataset: { group: "statuses", value: "seeking" } } });
  page.confirmFilters();
  assert.equal(page.data.people.length, 1);
  assert.equal(page.data.filterCount, 1);
  page.openFilters();
  page.resetFilterDraft();
  assert.equal(page.data.filterPreviewCount, 2);
  page.closeFilters();
  assert.equal(page.data.people.length, 1);
});

test("leaving nearby cancels location and late results; filters apply to real nearby people", () => {
  let releases = 0;
  const { page } = pageHarness("discover", {
    globalData: { eventId: "event-1", presenceActive: true },
    releasePresence: () => { releases += 1; },
  });
  page.pageVisible = true;
  page.nearbyGeneration = 1;
  page.setData({ mode: "nearby", nearbyEnabled: true, allNearby: [
    { user_id: "a", skills: ["设计"] }, { user_id: "b", skills: ["开发"] },
  ] });
  page.applyFilters({ status: "", skill: "开发" });
  assert.equal(page.data.nearby.length, 1);
  assert.equal(page.data.nearbyFocus.user_id, "b");
  assert.match(page.data.nearby[0].radarStyle, /^left:[0-9.]+%;top:[0-9.]+%;$/);
  page.selectMode({ currentTarget: { dataset: { mode: "directory" } } });
  assert.equal(releases, 1);
  assert.equal(page.data.nearbyEnabled, false);
  assert.equal(page.isNearbyRequestActive(1), false);
  assert.equal(page.data.nearby.length, 0);
});

test("all four buttons mount the shared sheet with close, selection and visibility handlers", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
  assert.equal(config.usingComponents["scope-selector"], "/components/scope-selector/index");
  for (const name of ["discover", "connections", "collaboration", "profile"]) {
    const { page, click, wxml } = pageHarness(name);
    assert.match(wxml, /<scope-selector[^>]*visible="{{scopeOpen}}"/);
    for (const handler of ["closeScopeSelector", "selectDiscoveryScope", "manageScopeVisibility"]) {
      assert.ok(wxml.includes(`="${handler}"`));
      assert.equal(typeof page[handler], "function");
    }
    click();
    page.closeScopeSelector();
    assert.equal(page.data.scopeOpen, false);
  }
});

test("scope component emits the same close action for its backdrop and close button", () => {
  const { component, events } = componentHarness();
  const wxml = fs.readFileSync(path.join(root, "components/scope-selector/index.wxml"), "utf8");
  assert.match(wxml, /class="scope-backdrop" bindtap="close"/);
  assert.match(wxml, /class="scope-close" bindtap="close"/);
  component.close();
  assert.equal(events[0].name, "close");
  component.selectEvent({ currentTarget: { dataset: { eventId: "unknown" } } });
  assert.equal(events.length, 1);
});

test("scope sheet owns the full content width and temporarily replaces the floating tab bar", () => {
  const { page, tabBar, click } = pageHarness("discover");
  const componentWxml = fs.readFileSync(path.join(root, "components/scope-selector/index.wxml"), "utf8");
  const componentWxss = fs.readFileSync(path.join(root, "components/scope-selector/index.wxss"), "utf8");
  const tabWxml = fs.readFileSync(path.join(root, "custom-tab-bar/index.wxml"), "utf8");

  assert.doesNotMatch(componentWxml, /<scroll-view[^>]*scope-options/,
    "the two-option sheet must not force its content through a fixed-height scroller");
  assert.doesNotMatch(componentWxml, /scope-option-list/,
    "the Web reference places option buttons directly in the full-width options container");
  assert.match(componentWxss, /\.scope-sheet\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(componentWxss, /\.scope-options\s*\{[^}]*width:\s*100%[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*align-items:\s*stretch/s);
  assert.match(componentWxss, /\.scope-option\s*\{[^}]*width:\s*100%[^}]*align-self:\s*stretch[^}]*display:\s*flex/s);
  assert.match(tabWxml, /wx:if="\{\{!overlayOpen\}\}"/);

  click();
  assert.equal(page.data.scopeOpen, true);
  assert.equal(tabBar.data.overlayOpen, true);
  page.closeScopeSelector();
  assert.equal(tabBar.data.overlayOpen, false);
});

test("selecting nearby persists browsing context without changing membership or granting location", async () => {
  const context = pageHarness("discover");
  context.page.setData({ eventChoices: [{ id: "event-1", name: "She Nicest 2026" }], eventName: "She Nicest 2026" });
  context.click();
  const { component, events } = componentHarness();
  component.selectNearby();
  await context.page.selectDiscoveryScope({ detail: events[0].detail });
  assert.equal(context.page.data.scopeOpen, false);
  assert.equal(context.page.data.mode, "nearby");
  assert.equal(context.app.globalData.eventId, "event-1");
  assert.equal(context.app.globalData.storage.get("cospan_discovery_scope"), "nearby");
  assert.equal(context.page.data.nearbyEnabled, false);
  assert.equal(context.page.data.scopeLabel, "日常附近");
  const profile = pageHarness("profile", context.app);
  profile.click();
  assert.equal(profile.page.data.discoveryScope, "nearby");
  assert.equal(profile.page.data.scopeLabel, "日常附近");
});

test("scope selection keeps the current tab; visibility management goes to the profile", async () => {
  const context = pageHarness("connections");
  context.page.setData({ eventChoices: [{ id: "event-1", name: "She Nicest 2026" }] });
  await context.page.selectDiscoveryScope({ detail: { scope: "nearby", eventId: "event-1" } });
  assert.deepEqual(context.navigation, []);
  context.click();
  context.page.manageScopeVisibility();
  assert.equal(context.page.data.scopeOpen, false);
  assert.equal(context.navigation[0], "/pages/profile/profile");
  const profile = pageHarness("profile");
  profile.click();
  profile.page.manageScopeVisibility();
  assert.deepEqual(profile.navigation, ["#profile-visibility"]);
});

test("returning to the current exhibition restores recommendation view, not a daily roster", async () => {
  const context = pageHarness("discover");
  context.page.setData({ discoveryScope: "nearby", mode: "nearby", eventChoices: [{ id: "event-1", name: "She Nicest 2026" }] });
  await context.page.selectDiscoveryScope({ detail: { scope: "event", eventId: "event-1" } });
  assert.equal(context.page.data.mode, "recommend");
  assert.equal(context.page.data.scopeLabel, "She Nicest 2026");
  assert.equal(context.page.data.nearbyEnabled, false);
});

test("zero exhibitions still opens the sheet, and an unknown selection cannot change context", async () => {
  const context = pageHarness("discover");
  context.click();
  assert.equal(context.page.data.scopeOpen, true);
  await context.page.selectDiscoveryScope({ detail: { scope: "event", eventId: "unknown" } });
  assert.equal(context.app.globalData.eventId, "event-1");
  const { component, events } = componentHarness({ events: [] });
  component.selectNearby();
  assert.equal(events.length, 0);
});

test("switching exhibitions clears stale profile controls before the new profile arrives", async () => {
  const context = pageHarness("profile");
  context.page.setData({ profile: { event_id: "event-1" }, visible: true, publicBlocks: [{ title: "old" }],
    eventChoices: [{ id: "event-1", name: "第一场" }, { id: "event-2", name: "第二场" }] });
  let resolveLoad;
  context.page.load = () => new Promise((resolve) => { resolveLoad = resolve; });
  const selection = context.page.selectDiscoveryScope({ detail: { scope: "event", eventId: "event-2" } });
  assert.equal(context.app.globalData.eventId, "event-2");
  assert.equal(context.page.data.profile, null);
  assert.equal(context.page.data.visible, false);
  assert.equal(context.page.data.publicBlocks.length, 0);
  resolveLoad();
  await selection;
});

test("an old exhibition load cannot overwrite a newly selected exhibition", async () => {
  const context = pageHarness("connections");
  let resolveEvents;
  context.app.globalData.api = { get: async (url) => url === "/api/events"
    ? new Promise((resolve) => { resolveEvents = resolve; }) : { requests: [] } };
  const loading = context.page.load();
  context.app.globalData.eventId = "event-2";
  context.page.setData({ eventName: "第二场", connected: [{ connection_id: "new" }] });
  resolveEvents({ events: [{ id: "event-1", name: "第一场" }] });
  await loading;
  assert.equal(context.page.data.eventName, "第二场");
  assert.equal(context.page.data.connected[0].connection_id, "new");
});

test("a location upload finishing after a scope switch deletes the old event presence only", async () => {
  const context = pageHarness("discover");
  const deleted = [];
  let resolveUpload;
  context.app.globalData.api = {
    put: () => new Promise((resolve) => { resolveUpload = resolve; }),
    delete: async (url) => deleted.push(url),
  };
  context.page.setData({ eventChoices: [{ id: "event-1", name: "第一场" }, { id: "event-2", name: "第二场" }] });
  context.page.pageVisible = true;
  context.page.nearbyGeneration = 1;
  context.page.load = async () => {};
  const upload = context.page.publishLocation(1);
  await Promise.resolve();
  await context.page.selectDiscoveryScope({ detail: { scope: "event", eventId: "event-2" } });
  resolveUpload();
  assert.equal(await upload, false);
  assert.deepEqual(deleted, ["/api/events/event-1/presence"]);
  assert.notEqual(context.app.globalData.presenceActive, true);
});

for (const name of ["discover", "connections", "collaboration", "profile"]) {
  test(`${name}: tapping current exhibition opens the range dialog even with only one exhibition`, () => {
    const { page, click, toasts } = pageHarness(name);
    page.setData({ eventChoices: [{ id: "event-1", name: "She Nicest 2026" }], eventName: "She Nicest 2026" });
    click();
    assert.equal(page.data.scopeOpen, true, "the range dialog must open; a toast is not a range selector");
    assert.equal(toasts.length, 0);
  });
}

const wcc = process.env.WECHAT_WCC || "/Applications/wechatwebdevtools.app/Contents/Resources/app.asar.unpacked/node_modules/wcc-exec/wcc";
test("the actual compiled WXML displays the range dialog and correct selected option after a page tap", {
  skip: !fs.existsSync(wcc),
}, () => {
  const filename = "components/scope-selector/index.wxml";
  const compiled = execFileSync(wcc, [filename], { cwd: root, encoding: "utf8", timeout: 15000 });
  const errors = [];
  const runtime = { window: {}, console: { log: (...args) => errors.push(args), warn: (...args) => errors.push(args) } };
  vm.createContext(runtime);
  vm.runInContext(compiled, runtime);
  const render = runtime.$gwx(filename);
  const flatten = (node) => !node || typeof node !== "object" ? [] : [node, ...(node.children || []).flatMap(flatten)];
  const context = pageHarness("discover");
  context.page.setData({ eventChoices: [{ id: "event-1", name: "She Nicest 2026" }] });
  const tree = (scope = "event") => flatten(render({ visible: context.page.data.scopeOpen, scope,
    eventId: "event-1", events: context.page.data.eventChoices }, {}));
  assert.equal(tree().some((node) => node.attr?.role === "dialog"), false);
  context.click();
  assert.equal(tree().filter((node) => node.attr?.role === "dialog").length, 1);
  assert.equal(tree().find((node) => node.attr?.ariaChecked === true).attr.bindtap, "selectEvent");
  assert.equal(tree("nearby").find((node) => node.attr?.ariaChecked === true).attr.bindtap, "selectNearby");
  context.page.closeScopeSelector();
  assert.equal(tree().some((node) => node.attr?.role === "dialog"), false);
  assert.deepEqual(errors, []);
});
