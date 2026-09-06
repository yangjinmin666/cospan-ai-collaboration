import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFilterDraft, filterPeople, type Person } from '../src/domain/discovery.ts';

test('筛选修改只进入草稿；取消和重置不改变已应用结果', () => {
  const filter = createFilterDraft();
  filter.open();
  filter.draft.roles.push('hardware');
  assert.deepEqual(filter.applied.roles, []);
  filter.cancel();
  filter.open();
  assert.deepEqual(filter.draft.roles, []);
  filter.draft.roles.push('design');
  filter.confirm();
  filter.open();
  filter.reset();
  assert.deepEqual(filter.applied.roles, ['design']);
  filter.confirm();
  assert.deepEqual(filter.applied.roles, []);
});

test('五组筛选共同约束；不自动放宽，也不修改原始名单', () => {
  const people = [
    { id: 'lin', roleGroup: 'hardware', statusGroup: 'seeking', distance: 3, hours: 8, publicEvidence: true },
    { id: 'su', roleGroup: 'design', statusGroup: 'support', distance: 2, hours: 4, publicEvidence: true },
    { id: 'new', roleGroup: 'hardware', statusGroup: 'seeking', distance: 1, hours: 2, publicEvidence: false },
  ] as Person[];
  const f = createFilterDraft();
  Object.assign(f.draft, { roles: ['hardware'], statuses: ['seeking'], minimumHours: 4, distance: 'very_near', evidenceRequired: true });
  f.confirm();
  assert.deepEqual(filterPeople(people, f.applied).map(p => p.id), ['lin']);
  f.applied.minimumHours = 12;
  assert.deepEqual(filterPeople(people, f.applied), []);
  assert.equal(people.length, 3);
});
