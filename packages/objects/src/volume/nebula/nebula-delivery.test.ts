import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NEBULA_DELIVERY_SCHEMA, readNebulaDelivery } from './nebula-delivery.ts';

const fixture = () => ({ schema: NEBULA_DELIVERY_SCHEMA, id: 'cloud', method: 'compiler',
  sky: { centerIcrsDegrees: [1, 2], distancePc: 3, imageRotationDegrees: 0, arcsecPerUnit: 1 },
  request: { path: '../../request.json', ignored: true }, inputPins: [{ path: 'source.json' }],
  framingRadiusUnits: 2, sourceUrl: 'https://example.test/cloud', description: 'Cloud',
  defaultDataset: 'optical', acceptedLabResult: 'accepted' });
const gridFixture = () => ({ ...fixture(), method: 'density-grid', compactMethod: 'density-grid',
  grids: [{ id: 'optical', label: 'Optical', recipe: { path: 'grid.json' }, occultingCentreUnits: [0, 1, 2] }] });

test('nebula envelopes preserve all historical method and optional-record subsets', () => {
  const parsed = readNebulaDelivery({ ...fixture(), compactInputs: { path: 'compact.json' }, compactMethod: 'sampled',
    compositeRecipe: { path: 'composite.json' }, attachedTo: 'star', fieldStars: { path: 'stars.json' }, ignored: true });
  assert.deepEqual(parsed.request, { path: '../../request.json' }); // Containment is the transport owner's check.
  assert.deepEqual(parsed.sky, fixture().sky);
  assert.equal(parsed.compactMethod, 'sampled');
  assert.equal(parsed.attachedTo, 'star');
  assert.deepEqual(parsed.fieldStars, { path: 'stars.json' });
  assert.deepEqual(parsed.compositeRecipe, { path: 'composite.json' });
  const symmetry = readNebulaDelivery({ ...fixture(), method: 'axial-symmetry', compactInputs: { path: 'compact.json' },
    compactMethod: 'symmetry', symmetryDirectory: 'output' });
  assert.equal(symmetry.symmetryDirectory, 'output');
  assert.deepEqual(readNebulaDelivery(gridFixture()).grids?.[0]?.occultingCentreUnits, [0, 1, 2]);
  // Envelope admission historically checks finiteness, not physical sky constraints.
  assert.equal(readNebulaDelivery({ ...fixture(), sky: { ...fixture().sky, distancePc: -1 } }).sky.distancePc, -1);
});

test('nebula delivery invalid envelopes retain exact diagnostics and validation order', () => {
  const cases: readonly [unknown, string][] = [
    [null, 'Expected nebula delivery object.'],
    [{ ...fixture(), sky: null, schema: 'wrong' }, 'Expected nebula delivery object.'],
    [{ ...fixture(), schema: 'wrong' }, 'Invalid nebula delivery recipe.'],
    [{ ...fixture(), id: '' }, 'Expected nebula delivery text.'],
    [{ ...fixture(), method: 'unknown' }, 'Invalid nebula delivery recipe.'],
    [{ ...fixture(), inputPins: null }, 'Invalid nebula delivery recipe.'],
    [{ ...fixture(), framingRadiusUnits: Infinity }, 'Expected finite nebula delivery value.'],
    [{ ...fixture(), framingRadiusUnits: 0 }, 'Invalid nebula framing/source URL.'],
    [{ ...fixture(), sourceUrl: 'http://example.test' }, 'Invalid nebula framing/source URL.'],
    [{ ...fixture(), attachedTo: 'Bad' }, 'Invalid attached body id.'],
    [{ ...fixture(), method: 'axial-symmetry', compositeRecipe: {} }, 'Optical composite requires compiler delivery.'],
    [{ ...fixture(), compactInputs: {}, compactMethod: 'wrong' }, 'Invalid compact bake method.'],
    [{ ...fixture(), compactInputs: {}, compactMethod: 'symmetry' }, 'Compact method and delivery method differ.'],
    [{ ...fixture(), method: 'density-grid' }, 'Density-grid delivery names its own compact method.'],
    [{ ...gridFixture(), grids: [] }, 'A density-grid delivery lists its grids.'],
    [{ ...gridFixture(), grids: [{ id: 'Bad' }] }, 'Invalid density-grid dataset id.'],
    [{ ...gridFixture(), grids: [{ ...gridFixture().grids[0], sourceUrl: 'http://example.test' }] }, 'Invalid density-grid source URL.'],
    [{ ...gridFixture(), grids: [{ ...gridFixture().grids[0], occultingCentreUnits: [0, 1] }] }, 'Invalid density-grid occulting centre.'],
    [{ ...gridFixture(), grids: [gridFixture().grids[0], gridFixture().grids[0]] }, 'Duplicate density-grid dataset id.'],
    [{ ...gridFixture(), defaultDataset: 'missing' }, 'The default dataset names no density grid.'],
    [{ ...fixture(), request: { path: '' } }, 'Expected nebula delivery text.'],
  ];
  for (const [value, message] of cases) assert.throws(() => readNebulaDelivery(value), { name: 'TypeError', message });
});

test('nebula preparation imports and calls the shared reader instead of defining another parser', () => {
  const source = readFileSync(new URL('../../../../bake/src/nebula/objects.ts', import.meta.url), 'utf8');
  assert.match(source, /import \{[^}]*\breadNebulaDelivery\b[^}]*\} from '@cssearth\/objects'/u);
  assert.match(source, /recipe = readNebulaDelivery\(JSON\.parse\(recipeBytes\.toString\(\)\)\)/u);
  assert.doesNotMatch(source, /(?:function|const|let)\s+(?:readNebulaDelivery|parseNebulaDelivery)\b/u);
  assert.doesNotMatch(source, /Invalid nebula delivery recipe\./u);
  const author = readFileSync(new URL('../../../../telescope-cli/authoring/circumstellar/author.mts', import.meta.url), 'utf8');
  assert.doesNotMatch(author, /ReturnType<typeof exposureAndOpacity>/u);
  assert.doesNotMatch(author, /interface EdgeOnReconstruction\b/u);
});
