const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "miniprogram/pages/discover/discover.js"),
  "utf8",
);

function createSwipeHarness() {
  let definition;
  const nextTicks = [];
  const timers = [];
  const sandbox = {
    require: createRequire(path.join(root, "miniprogram/pages/discover/discover.js")),
    Page(page) {
      definition = page;
    },
    getApp() {
      return { globalData: { storage: { get: () => false } } };
    },
    wx: {
      nextTick(callback) {
        nextTicks.push(callback);
      },
    },
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeout() {},
    setInterval() {},
    clearInterval() {},
    console,
    Math,
    Promise,
  };
  vm.runInNewContext(source, sandbox, { filename: "discover.js" });

  const patches = [];
  const page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) {
      patches.push({ ...patch });
      Object.assign(this.data, patch);
      callback?.();
    },
  };
  page.data.people = [
    { user_id: "person-a" },
    { user_id: "person-b" },
  ];
  page.data.currentPerson = page.data.people[0];
  page.data.nextPerson = page.data.people[1];
  page.data.currentIndex = 0;
  page.data.profileIncomplete = false;

  return {
    page,
    patches,
    flushNextTicks() {
      while (nextTicks.length) nextTicks.shift()();
    },
    runTimer(delay) {
      const index = timers.findIndex((timer) => timer.delay === delay);
      assert.notEqual(index, -1, `missing ${delay}ms timer`);
      timers.splice(index, 1)[0].callback();
    },
  };
}

function dragCard(page, deltaX) {
  page.startCardSwipe({ touches: [{ clientX: 100, clientY: 100 }] });
  page.moveCardSwipe({ touches: [{ clientX: 100 + deltaX, clientY: 102 }] });
}

test("a short horizontal drag arms the transition before smoothly resetting", () => {
  const harness = createSwipeHarness();
  dragCard(harness.page, 30);
  const beforeEnd = harness.patches.length;

  harness.page.endCardSwipe();
  const armPatch = harness.patches[beforeEnd];
  assert.equal(armPatch.cardTransition, "transform .2s ease, opacity .2s ease");
  assert.equal(Object.hasOwn(armPatch, "cardTransform"), false);
  assert.equal(harness.page.data.currentIndex, 0);

  harness.flushNextTicks();
  const targetPatch = harness.patches[beforeEnd + 1];
  assert.equal(targetPatch.cardTransform, "translateX(0) rotate(0deg)");
  assert.equal(targetPatch.cardOpacity, 1);
  assert.equal(Object.hasOwn(targetPatch, "cardTransition"), false);
  assert.equal(harness.page.data.currentIndex, 0);
});

test("a committed left swipe animates out before advancing to the next card", () => {
  const harness = createSwipeHarness();
  dragCard(harness.page, -80);
  const beforeEnd = harness.patches.length;

  harness.page.endCardSwipe();
  const armPatch = harness.patches[beforeEnd];
  assert.equal(armPatch.cardTransition, "transform .2s ease, opacity .2s ease");
  assert.equal(Object.hasOwn(armPatch, "cardTransform"), false);
  assert.equal(harness.page.data.currentIndex, 0);

  harness.flushNextTicks();
  const targetPatch = harness.patches[beforeEnd + 1];
  assert.equal(targetPatch.cardTransform, "translateX(-125%) rotate(-12deg)");
  assert.equal(targetPatch.cardOpacity, 0);
  assert.equal(harness.page.data.currentIndex, 0);

  harness.runTimer(190);
  assert.equal(harness.page.data.currentIndex, 1);
  assert.equal(harness.page.data.currentPerson.user_id, "person-b");
});
