import { expect, test } from 'vitest';
import { admitStableLabels, type StableLabelCandidate } from './stable-label-layout.js';
import { createLabelBudget } from './universe-label-policy.js';

const rect = (x: number) => ({ left: x, right: x + 30, top: 0, bottom: 15 });
const candidate = (id: string, x: number, shown = false): StableLabelCandidate => ({ id, navigable: true, pinned: 0, priority: 0,
  shown, previousPlacement: 0, placements: [{ slot: 0, rect: rect(x) }, { slot: 1, rect: rect(x + 50) }] });

test('a newcomer cannot steal a valid existing placement even with higher importance', () => {
  const old = candidate('old', 0, true), newcomer = { ...candidate('new', 0), priority: 1000 };
  const result = admitStableLabels([newcomer, old], createLabelBudget(500, 400));
  expect(result.map(item => [item.candidate.id, item.placement])).toEqual([['old', 0], ['new', 1]]);
});

test('reserve unaffected survivors before relocating a blocked survivor', () => {
  const moving = candidate('a', 0, true), still = candidate('b', 50, true);
  const result = admitStableLabels([moving, still], createLabelBudget(500, 400, [], [rect(0)]));
  expect(result.map(item => [item.candidate.id, item.placement])).toEqual([['b', 0]]);
});

test('clickable labels precede disabled survivors and explicit selection can displace either', () => {
  const disabled = { ...candidate('disabled', 0, true), navigable: false };
  const action = candidate('action', 0);
  expect(admitStableLabels([disabled, action], createLabelBudget(500, 400))[0]?.candidate.id).toBe('action');
  expect(admitStableLabels([{ ...disabled, pinned: 1 }, action], createLabelBudget(500, 400))[0]?.candidate.id).toBe('disabled');
});

test('committed alternate placement remains stable when its default side becomes free', () => {
  const label = { ...candidate('label', 0, true), previousPlacement: 1 };
  expect(admitStableLabels([label], createLabelBudget(500, 400))[0]?.placement).toBe(1);
});
