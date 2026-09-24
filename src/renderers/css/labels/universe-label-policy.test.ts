import { expect, test } from 'vitest';
import { coveredTopRects, createLabelBudget, labelEligible, labelExtentOpacity, labelImportance, UNIVERSE_LABEL_POLICY } from './universe-label-policy.js';

test('proper names and curated notable designations qualify independently', () => {
  expect(labelEligible({ named: true })).toBe(true);
  expect(labelEligible({ notable: true })).toBe(true);
  expect(labelEligible({ named: false, notable: false })).toBe(false);
  expect(labelImportance('satellite', true)).toBeGreaterThan(labelImportance('satellite'));
  expect(labelImportance('planet')).toBeGreaterThan(labelImportance('asteroid'));
  // A planet of another star holds its system's planet tier, so it keeps its caption at the scale that frames its orbit.
  expect(labelImportance('exoplanet')).toBe(labelImportance('planet'));
  expect(labelExtentOpacity(12)).toBe(0);
  expect(labelExtentOpacity(48)).toBe(1);
});

test('different layers consume one density and collision budget', () => {
  const body = { left: -200, right: -170, top: -100, bottom: -85 };
  const footprint = { left: 100, right: 200, top: 100, bottom: 200 };
  const budget = createLabelBudget(600, 900, [body], [footprint]);
  expect(budget.remaining).toBe(11);
  expect(budget.admit(body)).toBe(false);
  expect(budget.admit(footprint)).toBe(false);
  for (let i = 0; i < 11; i++) expect(budget.admit({ left: -100, right: -50, top: -300 + i * 25, bottom: -285 + i * 25 })).toBe(true);
  expect(budget.admit({ left: 0, right: 40, top: 0, bottom: 14 })).toBe(false);
  expect(budget.count).toBe(12);
});

test('Earth is the second orientation reference after the Sun, ahead of other planets', () => {
  // Orientation references come from prepared discovery, never from object ids in shared code.
  expect(labelImportance('star', true, 5)).toBeGreaterThan(labelImportance('planet', true, 4));
  expect(labelImportance('planet', true, 4)).toBeGreaterThan(labelImportance('planet', true));
  expect(labelImportance('planet', true, 0)).toBe(labelImportance('planet', true));
});

test('labels stay out of the band the shell header covers', () => {
  const viewport = { widthPixels: 800, heightPixels: 1000, coveredTopPixels: 60 };
  const budget = createLabelBudget(800, 1000, [], coveredTopRects(viewport));
  const at = (top: number) => ({ left: -40, right: 40, top, bottom: top + 18 });
  // The stage runs from -500 to 500; the header covers -500 to -440.
  expect(budget.accepts(at(-480)), 'a label under the header').toBe(false);
  expect(budget.accepts(at(-440 + UNIVERSE_LABEL_POLICY.spacingPixels + 1)), 'a label just below it').toBe(true);
  expect(coveredTopRects({ heightPixels: 1000 }), 'no header, no band').toEqual([]);
});
