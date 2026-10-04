import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parse, object, number } from '@cssearth/core/schema';
import { parseObjectDescriptor, readPreparedObject, parsePreparedCssPointFieldManifest, IMPERCEPTIBLE_LUMINANCE } from '@cssearth/objects';
import { magnitudeDisplayAlphaChange } from './point-field-bank.ts';

const base = new URL('../../../renderer/test/fixtures/point-field/', import.meta.url);
const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, base), 'utf8'));
const descriptor = parseObjectDescriptor(read('object.json'));
if (!descriptor.prepared) throw new Error('Point-field fixture must be prepared.');
const manifest = readPreparedObject(read(descriptor.prepared.url), descriptor, parsePreparedCssPointFieldManifest).data;
const atlas = parse(read('atlas-recipe.json'), object({ tileSize: number, haloRadii: number, coreInnerRadii: number,
  coreOuterRadii: number, haloPeak: number, samplesPerPixelAxis: number }), 'Fixture atlas recipe');

test('renderer fixture quantization is recomputed by the bake photometry producer', () => {
  const magnitude = manifest.bank.quantization.find(entry => entry.field === 'star.absoluteMagnitude');
  assert.ok(magnitude);
  assert.equal(magnitude.displayAlphaChange, magnitudeDisplayAlphaChange(manifest.photometry, atlas, magnitude.bound));
  assert.ok(magnitude.displayAlphaChange < IMPERCEPTIBLE_LUMINANCE);
  const steep = { ...manifest.photometry, step: 1e-4 };
  // Ordinary-point visibility is luminance >= the shared objects threshold.
  // Bake cannot import renderer; its reader separately tests this same threshold.
  assert.equal(magnitudeDisplayAlphaChange(steep, atlas, magnitude.bound) >= IMPERCEPTIBLE_LUMINANCE, true);
});
