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

test('one slot admits a caption and its circle atomically and reserves both footprints', () => {
  const first = { ...candidate('first', 30), anchor: rect(0), tier: 2 };
  const second = { ...candidate('second', 100), anchor: rect(40) };
  const budget = createLabelBudget(500, 400);
  expect(admitStableLabels([second, first], budget).map(item => item.candidate.id)).toEqual(['first']);
  expect(budget.count).toBe(1);
  expect(budget.accepts(rect(0))).toBe(false);
  expect(budget.accepts(rect(30))).toBe(false);
});

test('a blocked circle cannot leave a caption reservation or consume a slot', () => {
  const blocked = { ...candidate('blocked', 0), tier: 2, anchor: rect(150) };
  const other = candidate('other', 0);
  const budget = createLabelBudget(500, 400, [], [rect(150)]);
  expect(admitStableLabels([blocked, other], budget).map(item => item.candidate.id)).toEqual(['other']);
  expect(budget.count).toBe(1);
});


test('a featured tier displaces an ordinary survivor but stays stable among its peers', () => {
  const ordinary = { ...candidate('ordinary', 0, true), tier: 0 };
  const featured = { ...candidate('featured', 0), tier: 2 };
  expect(admitStableLabels([ordinary, featured], createLabelBudget(500, 400, [], [], 1))[0]?.candidate.id).toBe('featured');
  const peer = { ...candidate('peer', 0), tier: 2, priority: 9999 };
  expect(admitStableLabels([{ ...featured, shown: true }, peer], createLabelBudget(500, 400, [], [], 1))[0]?.candidate.id).toBe('featured');
  const selected = { ...ordinary, pinned: 1 };
  expect(admitStableLabels([selected, featured], createLabelBudget(500, 400, [], [], 1))[0]?.candidate.id).toBe('ordinary');
});
