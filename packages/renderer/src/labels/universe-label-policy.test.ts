import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { coveredTopRects, createLabelBudget, labelEligible, labelExtentOpacity, labelImportance, UNIVERSE_LABEL_POLICY } from './universe-label-policy.js';

test('proper names and curated notable designations qualify independently', () => {
  assert.equal(labelEligible({ named: true }), true);
  assert.equal(labelEligible({ notable: true }), true);
  assert.equal(labelEligible({ named: false, notable: false }), false);
  assert.ok(labelImportance('satellite', true) > labelImportance('satellite'));
  assert.ok(labelImportance('planet') > labelImportance('asteroid'));
  // A planet of another star holds its system's planet tier, so it keeps its caption at the scale that frames its orbit.
  assert.equal(labelImportance('exoplanet'), labelImportance('planet'));
  assert.equal(labelExtentOpacity(12), 0);
  assert.equal(labelExtentOpacity(48), 1);
});

test('different layers consume one density and collision budget', () => {
  const body = { left: -200, right: -170, top: -100, bottom: -85 };
  const footprint = { left: 100, right: 200, top: 100, bottom: 200 };
  const budget = createLabelBudget(600, 900, [body], [footprint]);
  assert.equal(budget.remaining, 11);
  assert.equal(budget.admit(body), false);
  assert.equal(budget.admit(footprint), false);
  for (let i = 0; i < 11; i++) assert.equal(budget.admit({ left: -100, right: -50, top: -300 + i * 25, bottom: -285 + i * 25 }), true);
  assert.equal(budget.admit({ left: 0, right: 40, top: 0, bottom: 14 }), false);
  assert.equal(budget.count, 12);
});

test('Earth is the second orientation reference after the Sun, ahead of other planets', () => {
  // Orientation references come from prepared discovery, never from object ids in shared code.
  assert.ok(labelImportance('star', true, 5) > labelImportance('planet', true, 4));
  // A star with something to see is captioned before one that is only marked notable, and after the Sun.
  assert.ok(labelImportance('star', false, 0, true, true) > labelImportance('star', false, 0, true));
  assert.ok(labelImportance('star', false, 0, false, true) > labelImportance('star', false, 0, true));
  assert.ok(labelImportance('star', false, 5) > labelImportance('star', false, 0, true, true));
  assert.equal(labelImportance('planet', false, 0, false, true), labelImportance('planet'), 'only a star is ranked by what it shows');
  assert.ok(labelImportance('planet', true, 4) > labelImportance('planet', true));
  assert.equal(labelImportance('planet', true, 0), labelImportance('planet', true));
});

test('labels stay out of the band the shell header covers', () => {
  const viewport = { widthPixels: 800, heightPixels: 1000, coveredTopPixels: 60 };
  const budget = createLabelBudget(800, 1000, [], coveredTopRects(viewport));
  const at = (top: number) => ({ left: -40, right: 40, top, bottom: top + 18 });
  // The stage runs from -500 to 500; the header covers -500 to -440.
  assert.equal(budget.accepts(at(-480)), false, 'a label under the header');
  assert.equal(budget.accepts(at(-440 + UNIVERSE_LABEL_POLICY.spacingPixels + 1)), true, 'a label just below it');
  assert.deepEqual(coveredTopRects({ heightPixels: 1000 }), [], 'no header, no band');
});
