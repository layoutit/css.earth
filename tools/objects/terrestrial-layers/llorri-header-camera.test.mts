import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../source-values.mts';
import { loadKernelSet } from '../../spice/kernel-set.mts';
import { llorriHeaderCamera } from './llorri-header-camera.mts';
import { bindSipCamera } from './llorri-geo.mts';

test('FITS camera and shared SPICE reproduce the independent Astropy projection anchors', async () => {
  const root = resolve('src/objects/donaldjohanson/source');
  const profile = requireRecord(JSON.parse(await readFile(resolve(root, 'preparation/camera.json'), 'utf8')));
  const reference = requireRecord(JSON.parse(await readFile(resolve(root, 'observations/llorri-camera.json'), 'utf8')));
  const bytes = await readFile(resolve(root, requireString(profile.image)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), reference.imageSha256);
  const kernels = await loadKernelSet(requireArray(profile.kernels).map(path => resolve(root, requireString(path))));
  const seed = llorriHeaderCamera(bytes, kernels, requireFiniteNumber(profile.bodyId));
  assert.equal(seed.checks.status, 'unregistered-header-seed');
  seed.sip.offsetPixels = requireArray(requireRecord(reference.sip).offsetPixels).map(value => requireFiniteNumber(value));
  const camera = bindSipCamera(seed);
  const anchors = requireArray(requireRecord(reference.checks).astropyProjectionAnchors);
  assert.equal(anchors.length, 16);
  for (const value of anchors) {
    const anchor = requireRecord(value), point = requireArray(anchor.pointKm).map(value => requireFiniteNumber(value));
    const expected = requireArray(anchor.pixel).map(value => requireFiniteNumber(value)), actual = camera.projectPoint(point);
    assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-7);
  }
});
