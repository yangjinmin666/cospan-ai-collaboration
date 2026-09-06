const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
test("mini icons match the shared Web SVG source byte for byte", async () => {
  const icons = await import(pathToFileURL(path.join(root, "../mobile-demo/assets/ui-icons.mjs")));
  const nav = ["discover", "connections", "collaboration", "profile"];
  for (const name of Object.keys(icons.iconPaths)) {
    for (const active of nav.includes(name) ? [false, true] : [false]) {
      const color = active ? "#347cf8" : nav.includes(name) ? "#89928d" : name === "settings" ? "#263543" : "#475463";
      const file = (nav.includes(name) ? "nav-" : "ui-") + name + (active ? "-active" : "") + ".svg";
      assert.equal(fs.readFileSync(path.join(root, "miniprogram/assets", file), "utf8").trim(), icons.renderUiIcon(name, color));
    }
  }
});
test("custom controls use SVG, never system-dependent arrow and gear glyphs", () => {
  const read = name => fs.readFileSync(path.join(root, "miniprogram/pages", name, name + ".wxml"), "utf8");
  assert.match(read("profile"), /ui-settings.svg/);
  assert.doesNotMatch(read("profile"), /⚙/);
  assert.match(read("discover"), /ui-filter.svg/);
  assert.match(read("discover"), /ui-back.svg/);
  assert.doesNotMatch(read("discover"), />←<|class="filter-lines"/);
});

test("scope option marks reuse 24px shared SVG icons instead of independent CSS drawings", () => {
  const scope = fs.readFileSync(path.join(root, "miniprogram/components/scope-selector/index.wxml"), "utf8");
  const style = fs.readFileSync(path.join(root, "miniprogram/components/scope-selector/index.wxss"), "utf8");
  for (const name of ["event", "nearby"]) assert.ok(scope.includes('class="ui-icon" src="/assets/ui-' + name + '.svg"'));
  assert.doesNotMatch(scope + style, /event-outline|nearby-ring|nearby-core|mark-dot/);
  assert.match(style, /\.scope-mark\s*\{[^}]*border:\s*2rpx solid #d8dfe7/);
});
