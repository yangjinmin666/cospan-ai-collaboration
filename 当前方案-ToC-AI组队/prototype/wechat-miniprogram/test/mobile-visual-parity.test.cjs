const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const { buildProfileBlocks } = require("../miniprogram/utils/profile-presenter.js");

test("nearby and directory share the readable mobile Web type scale and divider list", () => {
  const css = read("miniprogram/pages/discover/discover.wxss");
  const view = read("miniprogram/pages/discover/discover.wxml");
  const block = (name) => css.match(new RegExp("\\." + name + "\\s*\\{([^}]*)\\}"))[1];
  for (const name of ["mobile-discovery-caption", "ledger-status", "ledger-fit", "radar-person-name"]) {
    assert.match(block(name), /font-size: 24rpx/);
  }
  assert.match(block("ledger-main"), /font-size: 26rpx/);
  assert.match(block("ledger-name"), /font-size: 36rpx/);
  assert.match(block("ledger-person"), /border-bottom:/);
  assert.doesNotMatch(block("ledger-person"), /box-shadow|border-radius/);
  assert.doesNotMatch(block("ledger-name"), /flex-wrap: wrap/);
  for (const name of ["ledger-skills", "ledger-reason", "ledger-display-name", "ledger-status"]) {
    assert.match(block(name), /white-space: nowrap/);
    assert.match(block(name), /text-overflow: ellipsis/);
    assert.match(block(name), /overflow: hidden/);
  }
  assert.doesNotMatch(block("ledger-reason"), /line-clamp/);
  assert.match(block("ledger-skills"), /color: #17212d/);
  assert.match(block("ledger-reason"), /color: #687687/);
  assert.match(view, /class="ledger-reason">\{\{item.recommendation.reasons\[0\]\}\}/);
  assert.match(block("nearby-focus-action"), /min-height: 88rpx/);
  assert.match(view, /class="ledger-scan" bindtap="load"/);
  assert.match(view, /nearbyRequesting/);
  assert.match(view, /尚未开启附近/);
});

test("discover keeps the COSPAN mobile recommendation and nearby interaction model", () => {
  const view = read("miniprogram/pages/discover/discover.wxml");
  const logic = read("miniprogram/pages/discover/discover.js");
  const styles = read("miniprogram/pages/discover/discover.wxss");
  const config = JSON.parse(read("miniprogram/pages/discover/discover.json"));

  assert.equal(config.navigationStyle, "custom");
  assert.match(logic, /getMenuButtonBoundingClientRect/);
  assert.match(logic, /\[\.\.\.this\.data\.people, \.\.\.this\.data\.nearby\]\.find/);
  assert.match(logic, /mode === "recommend"[^]*currentPerson:/);
  assert.match(logic, /slice\(0, 11\)\.map/);
  assert.match(logic, /if \(!sent\) return false/);
  assert.match(view, /bindtouchstart="startCardSwipe"/);
  assert.match(view, /bindtouchmove="moveCardSwipe"/);
  assert.match(view, /bindtouchcancel="cancelCardSwipe"/);
  assert.doesNotMatch(view, /catchtouchmove="moveCardSwipe"/);
  assert.match(view, /filter-trigger[^]*event-trigger/);
  assert.doesNotMatch(view, /header-identity/);
  assert.match(styles, /\.app-header\s*\{[^}]*width:\s*max-content[^}]*justify-content:\s*flex-start/);
  assert.match(view, /src="\/assets\/ui-event.svg"/);
  assert.match(view, /recommendation-card-next[^]*next-person-avatar/);
  assert.match(view, /swipeProgress/);
  assert.match(logic, /this\.swipeAxis\s*=\s*""/);
  assert.match(logic, /Math\.min\(Math\.abs\(deltaX\)\s*\/\s*90,\s*1\)/);
  assert.match(logic, /async completePositiveSwipe/);
  assert.match(logic, /if \(sent\) this\.nextPerson\(\)/);
  assert.match(logic, /isNearbyRequestActive\(generation\)/);
  assert.match(logic, /wx\.createWebAudioContext/);
  assert.match(logic, /SWIPE_CUE_VOLUME\s*=\s*0\.27/);
  assert.match(view, />暂不看</);
  assert.match(view, />看详情</);
  assert.match(view, />想认识</);
  assert.match(view, /default-memoji-grid\.jpg/);
  assert.match(view, /radar-person/);
  assert.match(view, /查看为什么/);
  assert.match(logic, /function decorateRadar/);
  assert.match(view, /style="{{item.radarStyle}}"/);
  assert.match(styles, /radar-spin 8s linear infinite/);
  assert.doesNotMatch(view, /network-line/);
  assert.match(styles, /\.recommendation-actions\s*\{[^}]*display:\s*flex/);
  assert.match(styles, /\.recommendation-card-active\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
  assert.match(styles, /\.card-detail-cue\s*\{[^}]*margin-top:\s*auto/);
  assert.match(styles, /\.next-person-avatar\s*\{[^}]*filter:\s*grayscale\(1\)/);
});

test("connections reuses the same Memoji source and old mobile card hierarchy", () => {
  const view = read("miniprogram/pages/connections/connections.wxml");
  const logic = read("miniprogram/pages/connections/connections.js");
  const styles = read("miniprogram/pages/connections/connections.wxss");
  const config = JSON.parse(read("miniprogram/pages/connections/connections.json"));

  assert.equal(config.navigationStyle, "custom");
  assert.match(logic, /getMenuButtonBoundingClientRect/);
  assert.match(view, /default-memoji-grid\.jpg/);
  assert.match(view, /认识于/);
  assert.match(view, /最近消息/);
  assert.match(view, /继续对话/);
  assert.match(view, /查看共同项目/);
  assert.match(view, /connections-head[^]*event-trigger[^]*connections-title/);
  assert.match(styles, /\.connections-head\s*\{[^}]*width:\s*max-content[^}]*justify-content:\s*flex-start/);
  assert.doesNotMatch(view, /class="avatar connection-avatar"/);
});

test("collaboration keeps the venue control on the left of the WeChat capsule", () => {
  const view = read("miniprogram/pages/collaboration/collaboration.wxml");
  const logic = read("miniprogram/pages/collaboration/collaboration.js");
  const styles = read("miniprogram/pages/collaboration/collaboration.wxss");
  const config = JSON.parse(read("miniprogram/pages/collaboration/collaboration.json"));

  assert.equal(config.navigationStyle, "custom");
  assert.match(logic, /getMenuButtonBoundingClientRect/);
  assert.match(view, /collaboration-head[^]*event-trigger[^]*title">协作/);
  assert.doesNotMatch(view, /class="space-badge"/);
  assert.match(styles, /\.collaboration-head\s*\{[^}]*width:\s*max-content[^}]*justify-content:\s*flex-start/);
});

test("profile keeps the old mobile passport and outward-card hierarchy", () => {
  const view = read("miniprogram/pages/profile/profile.wxml");
  const logic = read("miniprogram/pages/profile/profile.js");
  const styles = read("miniprogram/pages/profile/profile.wxss");
  const config = JSON.parse(read("miniprogram/pages/profile/profile.json"));

  assert.equal(config.navigationStyle, "custom");
  assert.match(logic, /getMenuButtonBoundingClientRect/);
  assert.match(logic, /avatarClass/);
  assert.match(view, /class="profile-header"/);
  assert.match(view, /profile-header[^]*settings-trigger[^]*event-trigger[^]*profile-page-title/);
  assert.match(styles, /\.profile-header\s*\{[^}]*width:\s*max-content[^}]*justify-content:\s*flex-start/);
  assert.match(view, /default-memoji-grid\.jpg/);
  assert.match(view, /PASSPORT P·0087/);
  assert.match(view, /DISCOVERABILITY/);
  assert.match(logic, /visibilityTitle:\s*"展会内可见"/);
  assert.match(view, /OUTWARD COLLABORATION CARD/);
  assert.match(view, /对外协作卡/);
  assert.match(view, /4\.3″ 竖向现场工牌/);
  assert.match(view, /重新组装协作护照/);
  assert.match(view, /能力与项目证据/);
  assert.match(view, /登录邮箱/);
  assert.match(view, /滑动声效/);
  assert.match(view, /设备与隐私/);
  assert.match(view, /数据与授权/);
  assert.match(view, /展会与账号/);
  assert.match(view, /默认最小公开/);
  assert.match(view, /加载失败/);
  assert.match(view, /重新加载/);
  assert.match(view, /还没有协作证据 Block/);
  assert.doesNotMatch(styles, /\.profile-switch\s*\{[^}]*scale\(/);
  assert.match(styles, /\.profile-switch-wrap\s*\{[^}]*min-width:\s*104rpx[^}]*min-height:\s*88rpx/);
  assert.match(view, /class="platform-input"/);
  assert.match(styles, /\.platform-save-button\s*\{[^}]*min-height:\s*88rpx/);
  assert.match(styles, /\.profile-add-content, \.profile-edit-foundation\s*\{[^}]*min-height:\s*88rpx/);
  assert.match(styles, /\.settings-sheet\s*\{[^}]*height:\s*88vh/);
  assert.match(styles, /\.settings-close\s*\{[^}]*width:\s*88rpx[^}]*height:\s*88rpx/);
  assert.match(styles, /\.profile-logout-button\s*\{[^}]*background:\s*#(?:fff|ffffff)/);
  assert.doesNotMatch(styles, /\.profile-logout-button\s*\{[^}]*color:\s*#(?:d|e|f)[0-9a-f]{5}/i);
});

test("profile card keeps private blocks visible without publishing them", () => {
  const result = buildProfileBlocks({
    evidence: ["Agent 编排原型"],
    visibility: { state: "VISIBLE", public_fields: ["display_name"] },
  }, [
    { platform: "github", url: "https://github.com/cospan-demo" },
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.authorized), [false, false]);
  assert.deepEqual(result.map((item) => item.authorizationLabel), ["未公开", "未公开"]);
});

test("profile card marks only explicitly authorized evidence groups as public", () => {
  const result = buildProfileBlocks({
    evidence: ["Agent 编排原型"],
    visibility: { state: "VISIBLE", public_fields: ["evidence"] },
  }, [
    { platform: "website", url: "https://cospan.cn" },
  ]);

  assert.deepEqual(result.map((item) => item.authorized), [true, false]);
  assert.deepEqual(result.map((item) => item.authorizationLabel), ["已授权公开", "未公开"]);
});

test("Memoji sprite uses a supported local image element instead of WXSS url", () => {
  const sharedStyles = read("miniprogram/app.wxss");
  const onboardingStyles = read("miniprogram/pages/onboarding/onboarding.wxss");

  assert.match(sharedStyles, /\.memoji-sheet/);
  assert.doesNotMatch(sharedStyles, /default-memoji-grid\.jpg/);
  assert.doesNotMatch(onboardingStyles, /default-memoji-grid\.jpg/);
});

test("onboarding guide logo fills its mark without a second framed box", () => {
  const styles = read("miniprogram/pages/onboarding/onboarding.wxss");

  assert.match(styles, /\.guide-mark\s*\{[^}]*border:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/);
  assert.match(styles, /\.guide-mark image\s*\{[^}]*width:\s*108rpx[^}]*height:\s*108rpx/);
});
