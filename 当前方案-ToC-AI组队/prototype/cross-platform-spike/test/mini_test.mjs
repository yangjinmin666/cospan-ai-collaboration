// Run after `cli auto --project dist/build/mp-weixin --auto-port 9427`.
// Interact through rendered controls, never invoke app methods or patch app state.
import automator from 'miniprogram-automator';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wxml = fs.readFileSync('dist/build/mp-weixin/pages/discover/index.wxml', 'utf8');
const componentSelector = tag => {
  const id = wxml.match(new RegExp(`<${tag}\\b[^>]*u-i="([^"]+)"`))?.[1];
  assert.ok(id, `Missing generated component ${tag}`);
  return `[u-i="${id}"]`;
};
fs.mkdirSync('artifacts', { recursive: true });
const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9427' });
try {
  console.log('Starting isolated simulator checks; keep the Mac unlocked.');
  await mini.reLaunch('/pages/discover/index');
  const page = await mini.currentPage();
  await page.waitFor('.name');
  const tap = async (parent, selector) => {
    const element = await parent.$(selector);
    assert.ok(element, `Missing control ${selector}`);
    await element.tap();
    await page.waitFor(400);
  };
  const name = async () => (await page.$('.name')).text();
  const openFilter = async () => {
    await tap(page, '.filter-trigger');
    const host = await page.$(componentSelector('filter-sheet'));
    assert.ok(host);
    return host;
  };
  assert.equal(await name(), '林澈');
  console.log('Initial card ready; checking filters.');
  await mini.screenshot({ path: 'artifacts/wechat-final.png' });
  let filter = await openFilter();
  let chips = await filter.$$('.chip');
  const hardware = [];
  for (const chip of chips) if (await chip.text() === '硬件／结构') hardware.push(chip);
  assert.equal(hardware.length, 1);
  await hardware[0].tap();
  await tap(filter, '.sheet-footer .secondary');
  assert.equal(await (await page.$('.counter')).text(), '1 / 11');
  filter = await openFilter();
  chips = await filter.$$('.chip');
  for (const chip of chips) if (await chip.text() === '硬件／结构') {
    assert.equal((await chip.attribute('class')).includes('selected'), false);
    await chip.tap();
  }
  await mini.screenshot({ path: 'artifacts/wechat-filters.png' });
  await tap(filter, '.sheet-footer .primary');
  assert.notEqual(await (await page.$('.counter')).text(), '1 / 11');
  filter = await openFilter();
  await tap(filter, '.reset');
  await tap(filter, '.sheet-footer .primary');
  console.log('Filters ready; checking details.');
  await tap(page, '[aria-label="看详情"]');
  const detail = await page.$(componentSelector('person-sheet'));
  assert.ok(detail);
  assert.equal(await (await detail.$('.detail-name')).text(), '林澈');
  await mini.screenshot({ path: 'artifacts/wechat-details.png' });
  await tap(detail, '.expand-cue');
  assert.ok(await detail.$('.full-profile'));
  await mini.screenshot({ path: 'artifacts/wechat-details-expanded.png' });
  // Expanded sheet must stay below the immutable WeChat capsule.
  const capsule = await mini.callWxMethod('getMenuButtonBoundingClientRect');
  const sheet = await detail.$('.person-sheet');
  assert.ok((await sheet.offset()).top >= capsule.bottom);
  await tap(detail, '[aria-label="关闭详情"]');
  await tap(page, '[aria-label="暂不看"]');
  assert.equal(await name(), '苏晴');
  await tap(page, '.lab-link');
  await tap(page, '.overlay .secondary');
  await tap(page, '[aria-label="想认识"]');
  assert.equal(await name(), '苏晴');
  assert.match(await (await page.$('.toast')).text(), /模拟网络失败/);
  await tap(page, '[aria-label="想认识"]');
  assert.equal(await name(), '七喜');
  console.log('Mini simulator: filters, details, capsule clearance, skip, failed request and retry passed.');
} finally {
  mini.disconnect();
}
