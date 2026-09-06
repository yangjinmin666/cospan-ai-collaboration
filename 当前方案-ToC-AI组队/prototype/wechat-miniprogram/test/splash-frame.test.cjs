const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { FRAME, PATH_LENGTH, drawFrame, animateFrame } = require("../miniprogram/utils/splash-frame.js");
function context() {
  const paths = [], strokes = [];
  return { paths, strokes, clearRect() {}, scale() {}, setLineDash(value) { this.dash = value; },
    beginPath() { paths.push([]); }, moveTo(...p) { paths.at(-1).push(p); },
    lineTo(...p) { paths.at(-1).push(p); }, bezierCurveTo(...p) { paths.at(-1).push(p); },
    stroke() { strokes.push(this.lineDashOffset); } };
}
test("upper and lower openings stay aligned and both paths are mirrored", () => {
  const ctx = context();
  drawFrame(ctx, .5);
  assert.deepEqual(ctx.paths[0][0], [132,27]);
  assert.deepEqual(ctx.paths[0].at(-1), [132,195]);
  assert.deepEqual(ctx.paths[1][0], [148,27]);
  assert.deepEqual(ctx.paths[1].at(-1), [148,195]);
  for (let i = 0; i < ctx.paths[0].length; i++) {
    ctx.paths[0][i].forEach((n, j) => assert.equal(ctx.paths[1][i][j], j % 2 ? n : FRAME.width - n));
  }
  assert.equal(ctx.strokes[0], ctx.strokes[1]);
});
test("frames reveal more of the path without translating the frame", () => {
  const offsets = [.1, .5, 1].map(progress => { const ctx = context(); drawFrame(ctx, progress); return ctx.strokes[0]; });
  assert.ok(PATH_LENGTH > 300 && PATH_LENGTH < 400);
  assert.ok(offsets[0] > offsets[1] && offsets[1] > offsets[2]);
  assert.equal(offsets[2], 0);
});
test("canvas scales for device pixels and cancels animation on dispose", () => {
  const ctx = context(); let cancelled;
  const canvas = { getContext: () => ctx, requestAnimationFrame: () => 4, cancelAnimationFrame: id => cancelled = id };
  const stop = animateFrame(canvas, 280, 222, 3, Date.now());
  assert.equal(canvas.width, 840); assert.equal(canvas.height, 666);
  stop(); assert.equal(cancelled, 4);
});
test("Web and mini keep the same gap coordinates and timing", () => {
  const web = fs.readFileSync(path.join(__dirname, "../../mobile-demo/index.html"), "utf8");
  assert.match(web, /M132 27H72[^"]*H132/);
  assert.match(web, /M148 27H208[^"]*H148/);
  const css = fs.readFileSync(path.join(__dirname, "../../mobile-demo/assets/splash.css"), "utf8");
  assert.match(css, /\.84s[^;]*\.58s/);
});
