import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
import { checkLimbLaw, interpolateGrid, limbIntensity, readHowarthNode, readPublishedPowerLaw } from '@cssearth/bake/objects/stellar';

const test = sourceTest();
const node = (teff: number, logg: number, u1: number, u2 = 0.1, mass?: number) => ({ teff, logg, u1, u2, ...(mass === undefined ? {} : { mass }) });

test('a complete grid reads between the nearest nodes; a star on a node reads the bracket below it, as before', () => {
  const nodes = [node(3000, 4.5, 0.2), node(3100, 4.5, 0.3), node(3000, 5.0, 0.4), node(3100, 5.0, 0.5)];
  assert.ok(Math.abs(interpolateGrid(nodes, { teff: 3050, logg: 4.75 }).u1 - 0.35) < 1e-12);
  assert.deepEqual(interpolateGrid(nodes, { teff: 3100, logg: 5.0 }).corners.map(c => `${c.teff}/${c.logg}`), ['3000/4.5', '3000/5', '3100/4.5', '3100/5']);
});

test('a missing neighbour widens the bracket to the nearest complete set, never beyond the grid', () => {
  // PHOENIX at 3,000 K lacks log g 5.0 (Proxima's gap): the law is read between 4.5 and 5.5 there.
  const nodes = [4.5, 5.5].map(g => node(3000, g, g / 10)).concat([4.5, 5.0, 5.5].map(g => node(3100, g, g / 10)));
  const read = interpolateGrid(nodes, { teff: 3098, logg: 4.9 });
  assert.deepEqual([...new Set(read.corners.map(c => c.logg))], [4.5, 5.5]);
  assert.ok(Math.abs(read.u1 - 0.49) < 1e-12);
  assert.throws(() => interpolateGrid(nodes, { teff: 2900, logg: 4.9 }), /2900 is outside the grid 3000, 3100/u);
});

test('a spherical grid reads mass as a third axis, and only its laws may reach zero before the edge', () => {
  const nodes = [3600, 3700].flatMap(t => [-0.25, 0].flatMap(g => [12.5, 15].map(m => node(t, g, 1.1 + (m - 12.5) / 100, -0.02, m))));
  const read = interpolateGrid(nodes, { teff: 3660, logg: -0.05, mass: 15 }, { darkEdge: true });
  assert.equal(read.corners.length, 8); assert.ok(Math.abs(read.u1 - 1.125) < 1e-12);
  assert.throws(() => interpolateGrid(nodes, { teff: 3660, logg: -0.05, mass: 15 }), /keep the limb between dark/u);
  assert.throws(() => checkLimbLaw({ u1: 1.2, u2: 0 }), /keep the limb between dark/u);
  checkLimbLaw({ u1: 1.2, u2: 0 }, { darkEdge: true });
});

test("Howarth's files are read by model name, from the passband's quadratic line", () => {
  const text = ['Bessell-V             5467.7  5.61840E+07  2.08372E+07    -0.207', '     4-coeff     +4.7E-01 +5.5E-01 +1E-02 -2E-02 +2.7E-04 -7.0E-04',
    '     quadratic   +2.25617E-01 +3.71954E-01         +1.56919E-02 -4.19850E-02'].join('\n');
  assert.deepEqual(readHowarthNode('photometry/howarth-2011/t12000g15.ucE', text, 'Bessell-V'), { teff: 12000, logg: 1.5, u1: 0.225617, u2: 0.371954 });
  assert.throws(() => readHowarthNode('rigel.ucE', text, 'Bessell-V'), /named tNNNNNgNN/u);
  assert.throws(() => readHowarthNode('photometry/t12000g15.ucE', text, 'Bessell-B'), /no Bessell-B block/u);
});

test('a published power law is mu^alpha, cited by its cell or the model it was fixed to', () => {
  const law = readPublishedPowerLaw({ schema: 'cssearth-published-limb-darkening@1', law: 'power', source: 'Ohnaka et al. (2019)', band: 'K', alpha: { value: 0.61, uncertainty: 0.24, cell: '0.61 +/- 0.24' } });
  assert.deepEqual(law.alphaBounds, [0.61 - 0.24, 0.61 + 0.24]);
  assert.ok(Math.abs(limbIntensity(0.5, law) - 0.5 ** 0.61) < 1e-12);
  assert.equal(limbIntensity(0, law), 0);
  assert.throws(() => readPublishedPowerLaw({ schema: 'cssearth-published-limb-darkening@1', law: 'power', source: 's', band: 'K', alpha: { value: 0.6 } }), /alpha.uncertainty/u);
});
