import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarkerDeclutter, MARKER_ENTRY_MARGIN_PIXELS, type DeclutterMarker } from './marker-declutter.js';

const marker = (id: string, x: number, priority = 0, entry: Partial<DeclutterMarker['entry']> = {}): DeclutterMarker =>
  ({ x, y: 0, diameter: 2.4, visible: true, hovered: false, priority, entry: { body: { id }, labelShown: false, indicatorShown: false, ...entry } });

test('a pile of markers keeps its highest tier, then its highest priority, and hides the ones it covers', () => {
  const declutter = createMarkerDeclutter({ jupiter: 3 });
  const pile = [marker('a', 0, 5), marker('jupiter', .5, 1), marker('b', 1, 9), marker('far', 40)];
  declutter(pile, []);
  assert.deepEqual(pile.map(item => [item.entry.body.id, item.visible]), [['a', false], ['jupiter', true], ['b', false], ['far', true]]);
});

test('the focus, the selection and a hovered marker are kept first, over any tier', () => {
  const declutter = createMarkerDeclutter({ jupiter: 3 });
  const pile = [marker('jupiter', 0), marker('sun', .2), { ...marker('hovered', .6), hovered: true }];
  declutter(pile, ['sun', null]);
  assert.deepEqual(pile.map(item => item.visible), [false, true, true]);
});

test('a labelled moon never hides its planet: tier ranks before an admitted label', () => {
  // A label is admitted only once measured, and only a drawn marker is measured: ranking labels first kept Rhea over
  // Saturn at 220 AU for good.
  const declutter = createMarkerDeclutter({ saturn: 3, rhea: 1 });
  const pile = [marker('rhea', 0, 0, { labelShown: true }), marker('saturn', .5), marker('labelled-dust', 1, 0, { labelShown: true }), marker('dust', 1.5)];
  declutter(pile, []);
  assert.deepEqual(pile.map(item => [item.entry.body.id, item.visible]), [['rhea', false], ['saturn', true], ['labelled-dust', false], ['dust', false]]);
});

test('a drawn marker holds through a near tie, and an undrawn one returns only once it clears the kept dot by the margin', () => {
  const declutter = createMarkerDeclutter({});
  const frame = (x: number, drawn: boolean) => { const pair = [marker('kept', 0, 1, { markerDrawn: true }), marker('moving', x, 0, { markerDrawn: drawn })]; declutter(pair, []); return pair[1]!.visible; };
  assert.equal(frame(2, true), false, 'overlapping dots: the lower priority is hidden, drawn or not');
  assert.equal(frame(2.5, true), true, 'a drawn dot clear of touching (2.4 px) stays');
  assert.equal(frame(2.5, false), false, 'an undrawn one at the same place waits: a dot on the edge swapped every frame');
  assert.equal(frame(2.4 + MARKER_ENTRY_MARGIN_PIXELS, false), true, 'clear by the margin, it returns');
});

test('a drawn marker keeps its place in a pile over an undrawn one of the same standing', () => {
  const declutter = createMarkerDeclutter({});
  const pile = [marker('newcomer', 0, 9), marker('incumbent', 1, 1, { markerDrawn: true })];
  declutter(pile, []);
  assert.deepEqual(pile.map(item => item.visible), [false, true]);
  const fresh = [marker('newcomer', 0, 9), marker('incumbent', 1, 1)];
  declutter(fresh, []);
  assert.deepEqual(fresh.map(item => item.visible), [true, false], 'with nothing drawn, priority decides as before');
});
