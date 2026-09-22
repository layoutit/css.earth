import assert from 'node:assert/strict';
import test from 'node:test';
import type { BodyMap } from './jwst/cubes/body-map.mts';
import { combineUnderPolicy, assertProductsCombinable, definitionDigest, parseBodyMapProduct, resolutionElementsAcrossDisc, surfaceResolutionKm, type BodyMapObservation, type BodyMapProduct, type MeasurementDefinition } from './body-map-product.mts';

const salt: MeasurementDefinition = { quantity: 'equivalent width', units: 'Angstrom', timeDependence: 'surface-property', source: 'Trumbo, Brown & Hand 2019, doi:10.1126/sciadv.aaw7123',
  method: { kind: 'equivalent-width', bandAngstrom: [3500, 5300], continuum: { model: 'polynomial', order: 3, anchorsAngstrom: [[3100, 3500], [5300, 5500]] }, reference: 'mean of spectra without the band' } };
const heat: MeasurementDefinition = { quantity: 'brightness temperature', units: 'K', timeDependence: 'instantaneous-state', source: 'Trumbo, Brown & Butler 2018, doi:10.3847/1538-3881/aada87',
  method: { kind: 'brightness-temperature', frequencyHz: 231.6e9, convention: 'Planck', background: 'none added' } };
const seen = (id: string, midTimeJd: number, majorArcsec: number, rangeKm = 8.385e8): BodyMapObservation => ({ id, telescope: 'ALMA', instrument: 'band 6', midTimeJd, rangeKm,
  subObserver: { latitudeDegrees: -1.5, westLongitudeDegrees: 210.5 }, angularResolution: { majorArcsec, minorArcsec: majorArcsec / 2, basis: 'fitted clean beam' } });
const map = (definition: MeasurementDefinition, observations: BodyMapObservation[], combination?: BodyMapProduct['combination']): BodyMapProduct => ({ schema: 'cssearth-body-map@1', definition,
  frame: { body: 'europa', radiusKm: 1560.8, rotation: { model: 'pck00011.tpc', bodyCode: 502 } }, grid: { width: 720, height: 360, longitude: 'east-positive-from-0', rows: 'north-to-south' },
  planes: { file: 'surface-heat.fits', value: 'BRIGHTNESS TEMPERATURE', uncertainty: 'BRIGHTNESS TEMPERATURE ERROR' }, mask: { maximumEmissionDegrees: 60, missing: 'NaN' }, observations, ...(combination ? { combination } : {}) });

test('the same quantity and units are not the same measurement', () => {
  const otherWindow = { ...salt, method: { ...salt.method, bandAngstrom: [4000, 5000] } };
  assert.notEqual(definitionDigest(salt), definitionDigest(otherWindow));
  assert.equal(definitionDigest(salt), definitionDigest({ ...salt, source: 'a corrected citation' }), 'a citation is not part of what was measured');
  const policy = { time: { rule: 'time-invariant' }, resolution: { rule: 'as-observed' } } as const;
  assert.throws(() => assertProductsCombinable([map(salt, [seen('a', 2457000, 0.1)]), map(otherWindow, [seen('b', 2457001, 0.1)])], policy), /not the same measurement/u);
  assert.throws(() => assertProductsCombinable([map(salt, [seen('a', 2457000, 0.1)]), map(heat, [seen('b', 2457001, 0.1)])], policy), /not the same measurement/u);
});

test('an instantaneous state is never combined as if time did not matter', () => {
  const pair = [map(heat, [seen('nov-17', 2457343.9, 0.05)]), map(heat, [seen('nov-26', 2457352.9, 0.05)])];
  assert.throws(() => assertProductsCombinable(pair, { time: { rule: 'time-invariant' }, resolution: { rule: 'as-observed' } }), /instantaneous state/u);
  assert.throws(() => assertProductsCombinable(pair, { time: { rule: 'same-epoch-only', withinDays: 1 }, resolution: { rule: 'as-observed' } }), /span 9\.00 days/u);
  assertProductsCombinable(pair, { time: { rule: 'mosaic-of-snapshots' }, resolution: { rule: 'as-observed' } });
});

test('resolution differences need a stated policy, and kilometres need the range', () => {
  const sharp = seen('sharp', 2457352.9, 0.048), blurred = seen('blurred', 2457352.9, 0.3);
  assert.throws(() => assertProductsCombinable([map(heat, [sharp]), map(heat, [blurred])], { time: { rule: 'mosaic-of-snapshots' }, resolution: { rule: 'within-factor', factor: 2 } }), /factor of 6\.25/u);
  const onGround = surfaceResolutionKm(sharp);
  assert.ok(Math.abs(onGround.majorKm - 195.1) < 0.5 && onGround.where === 'sub-observer point', `${onGround.majorKm}`);
  assert.ok(Math.abs(surfaceResolutionKm(seen('near', 2457352.9, 0.048, 4.1925e8)).majorKm - 97.6) < 0.5, 'the same angle is half the kilometres at half the range');
  assert.ok(Math.abs(resolutionElementsAcrossDisc(sharp, 1560.8) - 16) < 0.1);
});

test('a record without a method, a range or a combination rule is refused', () => {
  assert.throws(() => parseBodyMapProduct({ ...map(heat, [seen('a', 2457352.9, 0.05)]), definition: { ...heat, method: {} } }), /not a definition/u);
  assert.throws(() => parseBodyMapProduct(map(heat, [{ ...seen('a', 2457352.9, 0.05), rangeKm: 0 }])), /range to the body/u);
  assert.throws(() => parseBodyMapProduct(map(heat, [seen('a', 2457343.9, 0.05), seen('b', 2457352.9, 0.05)])), /states how they were combined/u);
  assert.equal(parseBodyMapProduct(map(heat, [seen('a', 2457343.9, 0.05), seen('b', 2457352.9, 0.05)], { time: { rule: 'mosaic-of-snapshots' }, resolution: { rule: 'as-observed' } })).observations.length, 2);
});

const frame = { body: 'europa', radiusKm: 1560.8, rotation: { model: 'pck00011.tpc', bodyCode: 502 } };
/** A 4 x 2 map whose every cell has one value and was seen at one facing. */
const placed = (value: number, facing: number): BodyMap => ({ width: 4, height: 2, depth: new Float32Array(8).fill(value), error: new Float32Array(8).fill(1), seenCells: 8, areaShare: 1, facing: new Float32Array(8).fill(facing) });

test('the combination runs the policy it states: snapshots are kept, not averaged', () => {
  const mosaic = { time: { rule: 'mosaic-of-snapshots' }, resolution: { rule: 'as-observed' } } as const;
  const inputs = [{ map: placed(100, 0.9), definition: heat, frame, observation: seen('nov-17', 2457343.9, 0.05) }, { map: placed(200, 0.7), definition: heat, frame, observation: seen('nov-26', 2457352.9, 0.05) }];
  const result = combineUnderPolicy(inputs, mosaic, 60);
  assert.deepEqual([...result.map.depth], Array(8).fill(100), 'each cell keeps the snapshot that saw it most squarely; 100 K and 200 K never become 139 K');
  assert.deepEqual([...result.chosen!], Array(8).fill(0));
  assert.equal(result.overlaps[0]!.rmsDifference, 100, 'and the disagreement between the two moments is still reported');
  const invariant = combineUnderPolicy(inputs.map(input => ({ ...input, definition: salt })), { time: { rule: 'time-invariant' }, resolution: { rule: 'as-observed' } }, 60);
  assert.ok(invariant.map.depth[0]! > 100 && invariant.map.depth[0]! < 200 && invariant.chosen === null, 'a surface property is a weighted mean');
});

test('the combination itself refuses maps that are not one measurement', () => {
  const policy = { time: { rule: 'mosaic-of-snapshots' }, resolution: { rule: 'as-observed' } } as const;
  assert.throws(() => combineUnderPolicy([{ map: placed(100, 0.9), definition: heat, frame, observation: seen('a', 2457343.9, 0.05) }, { map: placed(0.1, 0.7), definition: salt, frame, observation: seen('b', 2457352.9, 0.05) }], policy, 60), /not the same measurement/u);
  assert.throws(() => combineUnderPolicy([{ map: placed(100, 0.9), definition: heat, frame, observation: seen('a', 2457343.9, 0.05) }, { map: placed(200, 0.7), definition: heat, frame, observation: seen('b', 2457352.9, 0.05) }], { time: { rule: 'time-invariant' }, resolution: { rule: 'as-observed' } }, 60), /instantaneous state/u);
});

test('a resolution limit looks at both axes of the beam', () => {
  const round = { ...seen('round', 2457352.9, 1), angularResolution: { majorArcsec: 1, minorArcsec: 1, basis: 'beam' } }, needle = { ...seen('needle', 2457352.9, 1), angularResolution: { majorArcsec: 1, minorArcsec: 0.01, basis: 'beam' } };
  assert.throws(() => assertProductsCombinable([map(heat, [round]), map(heat, [needle])], { time: { rule: 'mosaic-of-snapshots' }, resolution: { rule: 'within-factor', factor: 2 } }), /minor axis ranges over a factor of 100/u);
});

test('no production code averages placed maps except through the policy', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const root = new URL('./', import.meta.url), offenders: string[] = [];
  for (const entry of await readdir(root, { recursive: true })) {
    if (!entry.endsWith('.mts') || entry.endsWith('.test.mts') || entry === 'body-map-product.mts' || entry === 'jwst/cubes/body-map.mts') continue;
    if (/\bcombineBodyMaps\(/u.test(await readFile(new URL(entry, root), 'utf8'))) offenders.push(entry);
  }
  // The slit-scan stage compares trial placements with the averaging primitive as a diagnostic; its shipped map goes through the policy.
  assert.deepEqual(offenders.filter(entry => entry !== 'hst/slit-scan-map.mts'), []);
});

test('a snapshot mosaic keeps the emission limit it was asked for', () => {
  const mosaic = { time: { rule: 'mosaic-of-snapshots' }, resolution: { rule: 'as-observed' } } as const;
  // Both snapshots saw every cell at 60 degrees from straight down (facing 0.5). Asked for 30 degrees, nothing qualifies.
  const inputs = [{ map: placed(100, 0.5), definition: heat, frame, observation: seen('a', 2457343.9, 0.05) }, { map: placed(200, 0.5), definition: heat, frame, observation: seen('b', 2457352.9, 0.05) }];
  const strict = combineUnderPolicy(inputs, mosaic, 30);
  assert.ok([...strict.map.depth].every(Number.isNaN)); assert.equal(strict.map.seenCells, 0); assert.equal(strict.map.areaShare, 0);
  assert.equal(combineUnderPolicy(inputs, mosaic, 70).map.seenCells, 8);
});
