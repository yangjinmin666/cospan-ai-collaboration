import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeck } from '../src/domain/deck.ts';

test('短拖复位、点击看详情、纵向滑动不发出认识请求', async () => {
  let sent = 0;
  const deck = createDeck({ sendInterest: async () => { sent++; }, wait: async () => {} });
  deck.start(20, 20); deck.move(60, 21);
  assert.equal(await deck.end('lin'), 'reset');
  assert.equal(deck.x, 0);
  deck.start(20, 20); deck.move(90, 140);
  assert.equal(await deck.end('lin'), 'reset');
  deck.start(20, 20);
  assert.equal(await deck.end('lin'), 'details');
  assert.equal(sent, 0);
});

test('左滑只前进，不发认识请求；取消后下一次可继续滑动', async () => {
  const deck = createDeck({ sendInterest: async () => { throw Error('左滑不可请求'); }, wait: async () => {} });
  deck.start(150, 40); deck.move(70, 40); deck.reset();
  assert.equal(deck.x, 0); assert.equal(deck.dragging, false);
  deck.start(150, 40); deck.move(70, 40);
  assert.equal(await deck.end('lin'), 'next'); assert.equal(deck.busy, false);
});

test('右滑成功后前进，操作使用提交时的人物 ID', async () => {
  const ids: string[] = [];
  const deck = createDeck({ sendInterest: async id => { ids.push(id); }, wait: async () => {} });
  assert.equal(await deck.commit('right', 'lin'), 'next');
  assert.deepEqual(ids, ['lin']);
  assert.equal(deck.direction, ''); assert.equal(deck.busy, false);
});

test('达到 Web 的 72px 阈值后滑出；忙碌时不能再次提交；失败恢复同一人', async () => {
  let finish!: () => void;
  let sent = 0;
  const deck = createDeck({ sendInterest: async () => { sent++; throw new Error('网络中断'); }, wait: () => new Promise(r => { finish = r; }) });
  deck.start(10, 10); deck.move(82, 10);
  const operation = deck.end('lin');
  assert.equal(deck.direction, 'right');
  assert.equal(deck.busy, true);
  assert.equal(await deck.end('lin'), 'busy');
  finish();
  assert.equal(await operation, 'failed');
  assert.equal(deck.x, 0); assert.equal(deck.direction, ''); assert.equal(deck.busy, false);
  assert.equal(deck.error, '网络中断'); assert.equal(sent, 1);
});
