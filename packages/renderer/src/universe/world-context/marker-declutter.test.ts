import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarkerDeclutter, type DeclutterMarker } from './marker-declutter.js';

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

test('a frame decides from its own projection alone', () => {
  const declutter = createMarkerDeclutter({});
  const frame = (x: number) => { const pair = [marker('kept', 0, 1), marker('moving', x)]; declutter(pair, []); return pair[1]!.visible; };
  assert.equal(frame(2), false, 'overlapping dots: the lower priority is hidden');
  assert.equal(frame(2.5), true, 'clear of touching (2.4 px), it draws');
  assert.equal(frame(2), false);
});
