import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lightSwing, oneStarFor, oneStarSays, oneStarVerdict, parseOneStar, readOneStar } from './one-star.mts';

const ENTRY = { id: 'paper-2000', citation: 'Someone et al. (2000)', url: 'https://arxiv.org/abs/0001.00001', doi: '10.0/x', where: 'Sect. 3', mission: 'K2', target: 201000001, raDegrees: 10, decDegrees: -5,
  window: 5, lightCurve: { product: 'EVEREST', filename: 'a.fits', uri: 'mast:HLSP/everest/a.fits', described: 'an EVEREST light curve' }, periodDays: 2.5, periodErrorDays: 0.1, quote: 'The period is 2.5 d.', asks: 'a peak', reliability: 'none printed' };
const file = (entries: unknown[]) => ({ schema: 'cssearth-one-star-verdicts@1', entries });

test('an entry is read whole, and a wrong one is refused', () => {
  const [paper] = parseOneStar(file([ENTRY]));
  assert.equal(paper!.light.product, 'EVEREST'); assert.equal(paper!.printedIn, 'text'); assert.equal(paper!.table, 'Sect. 3: "The period is 2.5 d."');
  assert.deepEqual(oneStarVerdict(paper!), { detected: true, periodDays: 2.5 }); assert.equal(oneStarSays(paper!), 'a rotation period of 2.50 ± 0.1 d');
  assert.throws(() => parseOneStar(file([{ ...ENTRY, mission: 'TESS' }])), /K2 light only/u);
  assert.throws(() => parseOneStar(file([{ ...ENTRY, lightCurve: { ...ENTRY.lightCurve, product: 'K2SFF' } }])), /unknown light curve product/u);
  assert.throws(() => parseOneStar(file([{ ...ENTRY, lightCurve: { ...ENTRY.lightCurve, uri: 'mast:HLSP/everest/b.fits' } }])), /not its name at MAST/u);
  assert.throws(() => parseOneStar(file([ENTRY, { ...ENTRY, id: 'other' }])), /twice/u);
  assert.throws(() => parseOneStar({ schema: 'x', entries: [] }), /is not/u);
});

test('an entry is found by its target\'s place, within K2\'s 4 arcseconds', () => {
  const papers = parseOneStar(file([ENTRY]));
  assert.equal(oneStarFor(papers, [{ raDegrees: 20, decDegrees: 0 }, { raDegrees: 10 + 3 / 3600, decDegrees: -5 }])?.id, 'paper-2000');
  assert.equal(oneStarFor(papers, [{ raDegrees: 10 + 5 / 3600, decDegrees: -5 }]), undefined);
});

test('the swing is the 95th less the 5th percentile over the mean, as numpy takes them', () => {
  // numpy: percentile([0.9, 1, 1, 1.1], [5, 95]) = 0.915, 1.085.
  assert.equal(lightSwing([1, 0.9, 1.1, 1]), 0.17);
  assert.throws(() => lightSwing([]), /no light/u);
});

test('the shipped entries read', async () => {
  for (const paper of await readOneStar()) { assert.ok(paper.periodDays > 0); assert.match(paper.light.uri, /^mast:/u); }
});
