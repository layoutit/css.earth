import { expect, test } from 'vitest';
import { createZoomLensSelector } from './zoom-lens-selection.js';
import { requireControls } from '../validation/camera-controls.js';
const policy = { nearLens: 'surface', farLens: 'clouds', farBelowRatio: .72, nearAboveRatio: .88 };

test('crossings select both directions, with a stable gap and no requests on repeated frames', () => {
  const select = createZoomLensSelector(policy);
  expect(select(1, 'surface')).toBeNull();
  expect(select(.7, 'surface')).toBe('clouds');
  for (const ratio of [.7, .71, .75, .85, .87]) expect(select(ratio, 'clouds')).toBeNull();
  expect(select(.9, 'clouds')).toBe('surface');
  expect(select(.89, 'surface')).toBeNull();
});
test('reversing a pending automatic request uses the desired lens to cancel it', () => {
  const select = createZoomLensSelector(policy);
  select(1, 'surface');
  expect(select(.6, 'surface')).toBe('clouds');
  expect(select(1, 'clouds')).toBe('surface');
});
test('manual selection is kept until a crossing, and other datasets are never replaced', () => {
  const select = createZoomLensSelector(policy);
  select(1, 'surface');
  expect(select(1, 'clouds')).toBeNull();
  expect(select(.9, 'clouds')).toBeNull();
  expect(select(.6, 'elevation')).toBeNull();
  expect(select(1, 'elevation')).toBeNull();
  expect(select(.6, 'surface')).toBe('clouds');
});
test('an initial far view selects the far dataset, without retrying a failed crossing every frame', () => {
  const select = createZoomLensSelector(policy);
  expect(select(.6, 'surface')).toBe('clouds');
  expect(select(.5, 'surface')).toBeNull();
  expect(select(Number.NaN, 'surface')).toBeNull();
  expect(select(1, 'surface')).toBeNull();
  expect(select(.6, 'surface')).toBe('clouds');
});
test('prepared controls reject invalid automatic dataset rules', () => {
  const controls = (zoomSelection: unknown) => ({lenses:{defaultLens:'surface', controls:[{id:'surface',label:'Surface'},{id:'clouds',label:'Clouds'}],zoomSelection},settings:null});
  expect(() => requireControls(controls(policy))).not.toThrow();
  for (const bad of [{...policy, farLens:'missing'}, {...policy, farLens:'surface'}, {...policy, farBelowRatio:.9}, {...policy, nearAboveRatio:NaN}, {...policy, farBelowRatio:0}]) {
    expect(() => requireControls(controls(bad))).toThrow();
  }
});
