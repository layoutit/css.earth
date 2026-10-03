import test from 'node:test';
import assert from 'node:assert/strict';
import { parseObservedStellarCatalogue, readObservedStellarCatalogueEnvelope, OBSERVED_STELLAR_CATALOGUE_SCHEMA } from './observed-stellar-catalogue.ts';

function star(id: string, magnitudeV: number, colorIndexBV: number | null = null, raDegrees = 56.75, decDegrees = 24.12) {
  return { id, raDegrees, decDegrees, magnitudeV, colorIndexBV, sourceId: 'fixture-catalogue',
    properMotionRaCosDecMasPerYear: 20, properMotionDecMasPerYear: -45, sourceEpochJulianYear: 1991.25,
    sourceRaDegrees: raDegrees, sourceDecDegrees: decDegrees,
    photometry: { kind: 'johnson-measured', errorMagnitudeV: .01, errorColorIndexBV: colorIndexBV === null ? null : .02 } };
}
function catalogue(stars: ReturnType<typeof star>[]) {
  return { schema: 'cssearth-observed-stellar-catalogue@1', id: 'observed-fixture', frame: 'ICRS', coordinateEpochJulianYear: 2000, stars };
}

test('malformed catalogue fields, epoch and duplicate identities fail at the wire boundary', () => {
  const row = star('valid', 6, .2);
  for (const patch of [{ magnitudeV: NaN }, { raDegrees: 360 }, { decDegrees: 91 }, { colorIndexBV: 'blue' },
    { sourceEpochJulianYear: null }, { sourceRaDegrees: Infinity }, { properMotionRaCosDecMasPerYear: '20' },
    { photometry: { ...row.photometry, errorMagnitudeV: -1 } }, { photometry: { ...row.photometry, kind: 'invented' } }]) {
    assert.throws(() => parseObservedStellarCatalogue({ ...catalogue([]), stars: [{ ...row, ...patch }] }), TypeError);
  }
  const valid = catalogue([row]);
  assert.throws(() => parseObservedStellarCatalogue({ ...valid, coordinateEpochJulianYear: 2016 }), /epoch 2000/);
  assert.throws(() => parseObservedStellarCatalogue(catalogue([row, row])), /Duplicate/);
});

test('catalogue envelope keeps epoch 2000 and its 200000-row bound independently of row validation', () => {
  const input = { ...catalogue([]), stars: Array.from({ length: 200000 }, () => null) };
  assert.equal(readObservedStellarCatalogueEnvelope(input).stars.length, 200000);
  assert.throws(() => readObservedStellarCatalogueEnvelope({ ...input, stars: [...input.stars, null] }), /epoch 2000/);
  for (const patch of [{ schema: 'wrong' }, { frame: 'FK5' }, { id: ' ' }, { stars: null }])
    assert.throws(() => readObservedStellarCatalogueEnvelope({ ...catalogue([]), ...patch }), /epoch 2000/);
  const row = star('valid', 6, .2), parsed = parseObservedStellarCatalogue(catalogue([row]));
  assert.equal(parsed.schema, OBSERVED_STELLAR_CATALOGUE_SCHEMA);
  assert.deepEqual(parsed.stars, [row]);
});

test('caller frame admission follows one envelope read and precedes star admission', () => {
  const input = catalogue([null as never]);
  let reads = 0;
  const once = { ...input, get stars() { reads++; return input.stars; } };
  // Envelope validation inspects stars for array/length, then copies it; a second envelope pass would add three reads.
  assert.throws(() => parseObservedStellarCatalogue(once, () => { throw new Error('frame admission'); }), /frame admission/);
  assert.equal(reads, 3);
});
