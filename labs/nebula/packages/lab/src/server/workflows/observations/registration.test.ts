import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { applyAffine, invertAffine, detectStars, publisherTransform, verifyRegistration, type Affine, type Pair, type SkyFrame } from '@cssearth/nebula-reconstruction/registration/stellar';
import { readObservationRecipe } from '../../../features/observations/recipe.js';
import { readFile } from 'node:fs/promises';

test('native AVM reference pixel, not raster centre, anchors the sky coordinates', () => {
  const frame: SkyFrame = { width: 1024, height: 1024, fieldArcminutes: [60, 60], centerIcrsDegrees: [20, -20], northUp: true };
  const source = { width: 2000, height: 1000, fieldArcminutes: [30, 15] as [number, number], centerIcrsDegrees: [20, -20] as [number, number], northRightDegrees: 0,
    wcs: { projection: 'TAN' as const, coordinateFrame: 'ICRS' as const, referenceDimension: [2000, 1000] as [number, number], referencePixel: [100.5, 800.5] as [number, number],
      referenceValueDeg: [20, -20] as [number, number], scaleDeg: [-.00025, .00025] as [number, number], rotationDeg: 0 } };
  const m = publisherTransform(source, frame), center = applyAffine(m, [100, 200]);
  assert.ok(Math.hypot(center[0] - 512, center[1] - 512) < 1e-6);
  assert.ok(Math.hypot(...applyAffine(m, [1000, 500]).map((v, i) => v - center[i]!)) > 100);
  const recovered = applyAffine(invertAffine(m), center);
  assert.ok(Math.hypot(recovered[0] - 100, recovered[1] - 200) < 1e-8);
});

test('Omega Centauri native stars reject the former centred AVM reference pixels', async () => {
  const recipe = readObservationRecipe(JSON.parse(await readFile('labs/nebula/models/omega-centauri/observations.json', 'utf8')));
  const value: unknown = JSON.parse(await readFile('labs/nebula/packages/lab/src/server/workflows/observations/fixtures/omega-centauri-native-stars.json', 'utf8'));
  assert.ok(value && typeof value === 'object' && 'stars' in value && Array.isArray(value.stars));
  const reference = recipe.images.find(image => image.id === 'eso1119b')!, source = recipe.images.find(image => image.id === 'eso0844a')!;
  assert.ok('source' in value && 'reference' in value);
  assert.deepEqual(value.source, { id: source.id });
  assert.deepEqual(value.reference, { id: reference.id });
  const point = (input: unknown): [number, number] => {
    assert.ok(Array.isArray(input) && input.length === 2 && input.every(n => typeof n === 'number' && Number.isFinite(n)));
    return [input[0], input[1]];
  };
  const referenceMatrix = publisherTransform(reference, recipe.frame);
  const pairs: Pair[] = value.stars.map((row: unknown, index: number) => {
    assert.ok(row && typeof row === 'object' && 'source' in row && 'reference' in row);
    return { source: point(row.source), frame: applyAffine(referenceMatrix, point(row.reference)), sourceIndex: index, referenceIndex: index };
  });
  const footprint = { width: reference.width, height: reference.height, imageToFrame: referenceMatrix };
  const verified = verifyRegistration(pairs, source, recipe.frame, publisherTransform(source, recipe.frame), footprint);
  assert.equal(verified.pass, true);
  assert.ok(verified.evidence.residualArcseconds < .2);
  const centred = structuredClone(source);
  assert.ok(centred.wcs);
  centred.wcs.referencePixel = [centred.wcs.referenceDimension[0] / 2, centred.wcs.referenceDimension[1] / 2];
  assert.equal(verifyRegistration(pairs, centred, recipe.frame, publisherTransform(centred, recipe.frame), footprint).pass, false,
    'Replacing the publisher reference pixel with the raster centre destroys the qualified native alignment.');
  const corrupted = structuredClone(pairs);
  const heldOut = verified.evidence.matches.find(match => match.heldOut)!;
  corrupted.find(pair => pair.source[0] === heldOut.source[0] && pair.source[1] === heldOut.source[1])!.frame[0] += 3;
  assert.equal(verifyRegistration(corrupted, source, recipe.frame, publisherTransform(source, recipe.frame), footprint).pass, false);
});

test('Gaussian high-pass keeps channels aligned and finds actual compact sources', async () => {
  const width = 128, height = 96, raster = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = Math.round(40 + 180 * Math.exp(-((x - 44) ** 2 + (y - 31) ** 2) / 4));
    raster.fill(value, (y * width + x) * 3, (y * width + x + 1) * 3);
  }
  const image = await sharp(raster, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const stars = await detectStars(image, [width, height]);
  assert.equal(stars.length, 1);
  assert.ok(Math.hypot(stars[0]!.point[0] - 44.5, stars[0]!.point[1] - 31.5) < .01);
});

test('spatially held-out stars pass a correct affine and retain an incorrect held-out identity', () => {
  const source = { width: 1000, height: 800, fieldArcminutes: [60, 48] as [number, number], centerIcrsDegrees: [20, 20] as [number, number], northRightDegrees: 0 };
  const frame: SkyFrame = { width: 1024, height: 1024, fieldArcminutes: [60, 60], centerIcrsDegrees: [20, 20], northUp: true };
  const m: Affine = [.8, .001, -.001, .8, 100, 100], pairs: Pair[] = [];
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const point: [number, number] = [30 + 100 * x, 20 + 80 * y], i = y * 10 + x;
    pairs.push({ source: point, frame: applyAffine(m, point), sourceIndex: i, referenceIndex: i });
  }
  assert.equal(verifyRegistration(pairs, source, frame, m).pass, true);
  const corrupted = structuredClone(pairs);
  corrupted[0]!.frame[0] += 3;
  const result = verifyRegistration(corrupted, source, frame, m);
  assert.equal(result.pass, false);
  assert.ok(result.evidence.maxResidualPixels > 2.9);
  assert.equal(result.evidence.matches.filter(match => match.heldOut).length, 34);
});

test('observation recipe rejects unpinned and malformed sky inputs', async () => {
  const value = JSON.parse(await readFile('labs/nebula/models/helix/observations.json', 'utf8'));
  assert.equal(readObservationRecipe(value).images.length, 3);
  assert.throws(() => readObservationRecipe({ ...value, frame: { ...value.frame, northUp: false } }));
  const invalid = structuredClone(value); invalid.images[0].sha256 = 'unverified';
  assert.throws(() => readObservationRecipe(invalid));
});

test('registration measures coverage over the actual shared footprint, preserving held-out error gates', () => {
  const source = { width: 1000, height: 1000, fieldArcminutes: [60, 60] as [number, number], centerIcrsDegrees: [20, 20] as [number, number], northRightDegrees: 0 };
  const frame: SkyFrame = { width: 1000, height: 1000, fieldArcminutes: [60, 60], centerIcrsDegrees: [20, 20], northUp: true };
  const identity: Affine = [1, 0, 0, 1, 0, 0], pairs: Pair[] = [];
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const point: [number, number] = [110 + 28 * x, 210 + 28 * y];
    pairs.push({ source: point, frame: [...point], sourceIndex: y * 10 + x, referenceIndex: y * 10 + x });
  }
  const reference = { width: 300, height: 300, imageToFrame: [1, 0, 0, 1, 100, 200] as Affine };
  assert.equal(verifyRegistration(pairs, source, frame, identity).pass, false, 'The reference does not observe the full source.');
  assert.equal(verifyRegistration(pairs, source, frame, identity, reference).pass, true);
  const corrupted = structuredClone(pairs); corrupted[0]!.frame[0] += 3;
  assert.equal(verifyRegistration(corrupted, source, frame, identity, reference).pass, false, 'Bad held-out astrometry must still fail.');
  const concentrated = pairs.map(pair => ({ ...pair, source: [110 + (pair.source[0] - 110) * .2, 210 + (pair.source[1] - 210) * .2] as [number, number],
    frame: [110 + (pair.frame[0] - 110) * .2, 210 + (pair.frame[1] - 210) * .2] as [number, number] }));
  assert.equal(verifyRegistration(concentrated, source, frame, identity, reference).pass, false, 'A small matched patch cannot certify the overlap.');
});
