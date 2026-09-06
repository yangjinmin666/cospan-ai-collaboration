const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("new users can browse before publishing a collaboration profile", () => {
  const onboardingView = read("miniprogram/pages/onboarding/onboarding.wxml");
  const onboardingLogic = read("miniprogram/pages/onboarding/onboarding.js");
  const discoverView = read("miniprogram/pages/discover/discover.wxml");
  const discoverLogic = read("miniprogram/pages/discover/discover.js");
  const sharedStyles = read("miniprogram/app.wxss");
  const inputRule = sharedStyles.match(/\.input\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(inputRule, /height:\s*88rpx/);
  assert.match(inputRule, /padding:\s*0 24rpx/);
  assert.match(inputRule, /line-height:\s*88rpx/);
  assert.match(onboardingView, /bindtap="skip"/);
  assert.match(onboardingView, />先看看</);
  assert.match(onboardingLogic, /skip\(\)[^]*switchTab\([^]*pages\/discover\/discover/);
  assert.match(discoverLogic, /profileIncomplete/);
  assert.match(discoverLogic, /openOnboarding\(\)/);
  assert.match(discoverView, /wx:if="{{profileIncomplete}}"/);
  assert.match(discoverView, /disabled="{{profileIncomplete \|\| nearbyRequesting}}"/);
  assert.doesNotMatch(
    discoverLogic,
    /if \(!ownProfile \|\| ownProfile\.skills\.length < 3\) \{\s*wx\.navigateTo/,
  );
});
