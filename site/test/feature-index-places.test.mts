import assert from 'node:assert/strict';
import test from 'node:test';
import { featureResult, matchFeatures, parseFeatureIndex } from '../feature-search.mts';

// Cities are features of Earth: the cross-body index carries the most populous as one table, so they can be found from
// any body, and Earth's own catalogue searches every city while Earth is on screen.
const index = parseFeatureIndex({ schema: 'cssearth-prepared-feature-index@2',
  objects: [{ id: 'earth', name: 'Earth', route: '/earth/', count: 2 }, { id: 'mars', name: 'Mars', route: '/mars/', count: 1 }],
  features: [
    { objectId: 'mars', id: '1', name: 'Buenos Crater', type: 'Crater', diameterKm: 12, searchNames: ['buenos crater'], searchContext: 'crater' },
    { objectId: 'earth', id: '2', name: 'Atlantic Ocean', type: 'Ocean', diameterKm: 0, searchNames: ['atlantic ocean'], searchContext: 'ocean' }],
  places: [{ objectId: 'earth', type: 'City', rows: [['3435910', 'Buenos Aires', 'Buenos Aires F.D., Argentina']] }] },
{ url: '/features/index.json', bytes: 1, sha256: '0'.repeat(64), count: 3 });

test('a place row becomes a City feature of its body, selected by its city- id', () => {
  const city = index.features.find(feature => feature.id === 'city-3435910');
  assert.deepEqual(city, { objectId: 'earth', id: 'city-3435910', name: 'Buenos Aires', type: 'City', diameterKm: 0,
    searchNames: ['buenos aires'], searchContext: 'buenos aires f d argentina', context: 'Buenos Aires F.D., Argentina' });
});

test('from another body a city is found and links to its body', () => {
  const [first] = matchFeatures(index, 'buenos aires', 'mars');
  assert.equal(first?.id, 'city-3435910');
  assert.deepEqual(featureResult(first!, index, 'mars'), { name: 'Buenos Aires', context: 'City · Buenos Aires F.D., Argentina · Earth',
    label: 'Buenos Aires, Buenos Aires F.D., Argentina · Earth', href: '/earth/?feature=city-3435910' });
});

test('on the body that searches its own places, the index leaves them out', () => {
  assert.deepEqual(matchFeatures(index, 'buenos', 'earth', 8, { ownPlaces: false }).map(feature => feature.id), ['1']);
  assert.deepEqual(matchFeatures(index, 'buenos', 'earth').map(feature => feature.id), ['city-3435910', '1']);
});

test('a place table row must be an id, a name and a context', () => {
  const bad = (rows: unknown) => () => parseFeatureIndex({ schema: 'cssearth-prepared-feature-index@2', objects: [], features: [],
    places: [{ objectId: 'earth', type: 'City', rows }] }, { url: '/i', bytes: 1, sha256: '0'.repeat(64), count: 1 });
  assert.throws(bad([['x1', 'Paris', 'France']]), /place is invalid/);
  assert.throws(bad([['1', 'Paris']]), /place is invalid/);
});
