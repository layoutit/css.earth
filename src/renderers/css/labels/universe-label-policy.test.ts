import { expect, test } from 'vitest';
import { createLabelBudget, labelEligible, labelExtentOpacity, labelImportance } from './universe-label-policy.js';

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
