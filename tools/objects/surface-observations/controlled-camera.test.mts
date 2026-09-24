/** Controlled cameras: the lit source shape must land on the photographed body, and a published photometric model resolves against its record. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { requireArray, requireRecord } from '@cssearth/core';
import type { PixelGeometry } from './contract.mts';
import { MAXIMUM_LIT_SHAPE_ON_SKY, litShapeOnSky, parseControlledCameraLens } from './formats/controlled-camera.mts';
import { publishedPhotometry } from './photometry.mts';

const root = resolve(import.meta.dirname, '../../..');

// Five detector pixels: pixels 0-3 hit the source shape and pixel 4 misses it. Pixel 3 lies beyond an 80-degree incidence limit.
const geometry: PixelGeometry = { source: 'source-mesh-rays', report: {},
  reject: i => i < 4 ? null : 'no-geometry', incidence: i => (i === 3 ? 85 : 40) * Math.PI / 180, emission: () => 0, phase: () => 0,
  distanceMeters: () => 0, rangeMeters: () => 1 };

test('lit shape on sky counts only lit shape pixels, and the archive quality mask is not sky', () => {
  // Lit shape: pixels 0, 1 and 2. Pixel 1 is edge-connected sky; pixel 2 is withheld by the archive's quality data instead.
  const report = litShapeOnSky(geometry, Uint8Array.from([0, 1, 1, 1, 1]), Uint8Array.from([0, 0, 1, 0, 0]), 80, 5);
  assert.deepEqual(report, { litPixels: 3, onSkyPixels: 1, share: 1 / 3, maximumShare: MAXIMUM_LIT_SHAPE_ON_SKY });
  assert.ok(report.share > MAXIMUM_LIT_SHAPE_ON_SKY, 'a third of the lit shape on sky refuses the frame');
  assert.equal(litShapeOnSky(geometry, Uint8Array.from([0, 0, 0, 1, 1]), undefined, 80, 5).share, 0, 'shape beyond the incidence limit and sky beside the shape do not count');
  assert.equal(litShapeOnSky(geometry, undefined, undefined, 80, 5).share, 0, 'a frame without a sky threshold has no sky to test against');
});

test("Ida's published camera photometry resolves against its model record and the publication it cites", async () => {
  const sourceRoot = resolve(root, 'src/objects/ida/source');
  const profile = requireRecord(JSON.parse(await readFile(resolve(sourceRoot, 'preparation/terrestrial.json'), 'utf8')));
  const lens = requireArray(requireRecord(profile.raster).surfaceObservations).map(value => requireRecord(value)).find(value => value.id === 'calibrated');
  const block = parseControlledCameraLens(lens).photometry;
  if (!('referenceDegrees' in block)) throw new Error("Ida's calibrated lens does not name a published photometric model.");
  const source = await createSourceManifest({ objectId: 'ida', objectName: 'Ida', sourceRoot });
  const photometry = await publishedPhotometry(sourceRoot, source.manifest, block);
  assert.equal(photometry.report.model, 'helfenstein-1996-hapke');
  assert.deepEqual(photometry.report.citations, ['doi-10-1006-icar-1996-0036']);
  const rad = Math.PI / 180, atReference = photometry.gain(25 * rad, 0, 25 * rad);
  assert.ok(atReference !== null && Math.abs(atReference - 1) < 1e-12, 'the reference geometry keeps its brightness');
  assert.equal(photometry.gain(80 * rad, 10 * rad, 25 * rad), null, 'incidence beyond the limit is withheld');
});
