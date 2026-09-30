import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { admitStableLabels, type StableLabelCandidate } from './stable-label-layout.js';
import { createLabelBudget } from './universe-label-policy.js';

const rect = (x: number) => ({ left: x, right: x + 30, top: 0, bottom: 15 });
const candidate = (id: string, x: number, shown = false): StableLabelCandidate => ({ id, navigable: true, pinned: 0, priority: 0,
  shown, previousPlacement: 0, placements: [{ slot: 0, rect: rect(x) }, { slot: 1, rect: rect(x + 50) }] });

test('a newcomer cannot steal a valid existing placement even with higher importance', () => {
  const old = candidate('old', 0, true), newcomer = { ...candidate('new', 0), priority: 1000 };
  const result = admitStableLabels([newcomer, old], createLabelBudget(500, 400));
  assert.deepEqual(result.map(item => [item.candidate.id, item.placement]), [['old', 0], ['new', 1]]);
});

test('reserve unaffected survivors before relocating a blocked survivor', () => {
  const moving = candidate('a', 0, true), still = candidate('b', 50, true);
  const result = admitStableLabels([moving, still], createLabelBudget(500, 400, [], [rect(0)]));
  assert.deepEqual(result.map(item => [item.candidate.id, item.placement]), [['b', 0]]);
});

test('clickable labels precede disabled survivors and explicit selection can displace either', () => {
  const disabled = { ...candidate('disabled', 0, true), navigable: false };
  const action = candidate('action', 0);
  assert.equal(admitStableLabels([disabled, action], createLabelBudget(500, 400))[0]?.candidate.id, 'action');
  assert.equal(admitStableLabels([{ ...disabled, pinned: 1 }, action], createLabelBudget(500, 400))[0]?.candidate.id, 'disabled');
});

test('committed alternate placement remains stable when its default side becomes free', () => {
  const label = { ...candidate('label', 0, true), previousPlacement: 1 };
  assert.equal(admitStableLabels([label], createLabelBudget(500, 400))[0]?.placement, 1);
});

test('one slot admits a caption and its circle atomically and reserves both footprints', () => {
  const first = { ...candidate('first', 30), anchor: rect(0), tier: 2 };
  const second = { ...candidate('second', 100), anchor: rect(40) };
  const budget = createLabelBudget(500, 400);
  assert.deepEqual(admitStableLabels([second, first], budget).map(item => item.candidate.id), ['first']);
  assert.equal(budget.count, 1);
  assert.equal(budget.accepts(rect(0)), false);
  assert.equal(budget.accepts(rect(30)), false);
});

test('a blocked circle cannot leave a caption reservation or consume a slot', () => {
  const blocked = { ...candidate('blocked', 0), tier: 2, anchor: rect(150) };
  const other = candidate('other', 0);
  const budget = createLabelBudget(500, 400, [], [rect(150)]);
  assert.deepEqual(admitStableLabels([blocked, other], budget).map(item => item.candidate.id), ['other']);
  assert.equal(budget.count, 1);
});


test('a featured tier displaces an ordinary survivor but stays stable among its peers', () => {
  const ordinary = { ...candidate('ordinary', 0, true), tier: 0 };
  const featured = { ...candidate('featured', 0), tier: 2 };
  assert.equal(admitStableLabels([ordinary, featured], createLabelBudget(500, 400, [], [], 1))[0]?.candidate.id, 'featured');
  const peer = { ...candidate('peer', 0), tier: 2, priority: 9999 };
  assert.equal(admitStableLabels([{ ...featured, shown: true }, peer], createLabelBudget(500, 400, [], [], 1))[0]?.candidate.id, 'featured');
  const selected = { ...ordinary, pinned: 1 };
  assert.equal(admitStableLabels([selected, featured], createLabelBudget(500, 400, [], [], 1))[0]?.candidate.id, 'ordinary');
});

function star(id: string, x: number, y: number, width: number, shown = false): StableLabelCandidate {
  const positions = [[x + 12, y - 9], [x - 12 - width, y - 9], [x - width / 2, y - 30], [x - width / 2, y + 12]];
  return { ...candidate(id, x, shown), tier: 3,
    anchor: { left: x - 8, right: x + 8, top: y - 8, bottom: y + 8 },
    placements: positions.map(([left, top], slot) => ({ slot, rect: { left, right: left + width, top, bottom: top + 18 } })),
  };
}

for (const shown of [false, true]) test(`a caption moves aside for neighboring circles, including committed placements: ${shown}`, () => {
  // Measured from the reported Sirius / Alpha Centauri / Luhman 16 view.
  const sirius = { ...star('sirius', 0, 0, 44, shown), priority: 10 };
  const alpha = { ...star('alpha-centauri-a', 62.62, -14.09, 130), priority: 5 };
  const companion = star('alpha-centauri-b', 62.62, -14.09, 130);
  const luhman = star('luhman-16', 33.97, 12.16, 92);
  const stars = [sirius, alpha, companion, luhman];
  const result = admitStableLabels(stars, createLabelBudget(500, 400));
  assert.deepEqual(result.map(item => item.candidate.id).sort(), ['alpha-centauri-a', 'luhman-16', 'sirius']);
  assert.equal(result.find(item => item.candidate === sirius)?.placement, 1);
  // Once the three annotations fit, publishing their history must keep them stable.
  for (const item of result) Object.assign(item.candidate, { shown: true, previousPlacement: item.placement });
  const next = admitStableLabels(stars, createLabelBudget(500, 400));
  assert.deepEqual(next.map(item => [item.candidate.id, item.placement]).sort(), result.map(item => [item.candidate.id, item.placement]).sort());
});

test('an unavailable neighbor does not move a survivor caption', () => {
  const first = star('first', 0, 0, 44, true), peer = star('peer', 34, 12, 92);
  const budget = createLabelBudget(500, 400, [], [{ left: 26, right: 42, top: 19, bottom: 22 }]);
  assert.deepEqual(admitStableLabels([first, peer], budget).map(item => [item.candidate.id, item.placement]), [['first', 0]]);
  assert.deepEqual(admitStableLabels([first, peer], createLabelBudget(500, 400, [], [], 1))
    .map(item => [item.candidate.id, item.placement]), [['first', 0]]);
});

test('an unavoidable caption-circle collision still follows admission priority', () => {
  const first = star('first', 0, 0, 44, true), peer = star('peer', 34, 12, 92);
  first.placements = first.placements.slice(0, 1);
  assert.deepEqual(admitStableLabels([first, peer], createLabelBudget(500, 400)).map(item => item.candidate.id), ['first']);
});
