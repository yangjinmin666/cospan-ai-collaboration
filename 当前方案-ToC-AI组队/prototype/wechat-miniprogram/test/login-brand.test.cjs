const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

test("login screen reuses the COSPAN mobile splash identity", () => {
  const wxml = fs.readFileSync(
    path.join(projectRoot, "miniprogram/pages/login/login.wxml"),
    "utf8",
  );
  const pageConfig = JSON.parse(
    fs.readFileSync(
      path.join(projectRoot, "miniprogram/pages/login/login.json"),
      "utf8",
    ),
  );
  const logoPath = path.join(
    projectRoot,
    "miniprogram/assets/cospan-logo.png",
  );
  const pageLogic = fs.readFileSync(
    path.join(projectRoot, "miniprogram/pages/login/login.js"),
    "utf8",
  );
  const pageStyles = fs.readFileSync(
    path.join(projectRoot, "miniprogram/pages/login/login.wxss"),
    "utf8",
  );
  const sloganRule = pageStyles.match(/\.splash-slogan-cn\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(wxml, /src="\/assets\/cospan-logo\.png"/);
  assert.match(wxml, /人与人先相遇，/);
  assert.match(wxml, /人与 Agent 再共创。/);
  assert.match(wxml, /Meet as people\./);
  assert.match(wxml, /Build with agents\./);
  assert.match(wxml, /style="top: {{contactSceneTop}}px;"/);
  assert.doesNotMatch(wxml, /class="brand-mark">C</);
  assert.doesNotMatch(wxml, />\s*微信一键进入\s*</);
  assert.match(wxml, /wx:if="{{loginError}}"/);
  assert.match(wxml, /login-page {{isExiting \? 'is-exiting' : ''}}/);
  assert.match(pageLogic, /scheduleAutoLogin\(\)/);
  assert.match(pageLogic, /setTimeout\([^]*this\.login\(\)/);
  assert.match(pageLogic, /SPLASH_MIN_VISIBLE_MS\s*=\s*2400/);
  assert.match(pageLogic, /SPLASH_EXIT_DURATION_MS\s*=\s*360/);
  assert.match(pageLogic, /navigateAfterSplash/);
  assert.match(pageLogic, /getMenuButtonBoundingClientRect\(\)/);
  assert.match(pageLogic, /navigationBottom \+ 8/);
  assert.doesNotMatch(sloganRule, /letter-spacing:\s*-/);
  assert.match(sloganRule, /font-weight:\s*700/);
  assert.match(pageStyles, /\.login-page\.is-exiting\s*\{[^}]*opacity:\s*0[^}]*scale\(1\.015\)/);
  assert.equal(pageConfig.navigationStyle, "custom");
  assert.equal(pageConfig.disableScroll, true);
  assert.ok(fs.statSync(logoPath).size > 1_000);
});
