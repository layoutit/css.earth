import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '@cssearth/core';
import { loadKernelSet } from '@cssearth/spice/node';
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

test('a header seed takes a lone field-of-view target, and needs a named one when the frame shows several', async () => {
  const root = resolve('src/objects/donaldjohanson/source');
  const profile = requireRecord(JSON.parse(await readFile(resolve(root, 'preparation/camera.json'), 'utf8')));
  const bytes = await readFile(resolve(root, requireString(profile.image)));
  const kernels = await loadKernelSet(requireArray(profile.kernels).map(path => resolve(root, requireString(path))));
  const bodyId = requireFiniteNumber(profile.bodyId);
  assert.equal(llorriHeaderCamera(bytes, kernels, bodyId).target, 'DONALDJOHANSON');
  // Give the real header a second body: TRGFOVN becomes 2 and a card the seed never reads becomes TRGFOV2.
  const two = Buffer.from(bytes), header = two.subarray(0, 131040).toString('latin1'), cards: string[] = [];
  for (let offset = 0; offset < header.length && !header.startsWith('END ', offset); offset += 80) cards.push(header.slice(offset, offset + 80));
  const card = (text: string) => Buffer.from(text.padEnd(80, ' '), 'latin1');
  const index = (match: (key: string) => boolean) => { const found = cards.findIndex(line => match(line.slice(0, 8).trim())); assert.ok(found >= 0); return found * 80; };
  card(`TRGFOVN = ${'2'.padStart(20)}`).copy(two, index(key => key === 'TRGFOVN'));
  card("TRGFOV2 = 'SELAM'").copy(two, index(key => !/^(SIMPLE|BITPIX|NAXIS\d*|EXTEND|CTYPE[12]|CRVAL[12]|CRPIX[12]|CD[12]_[12]|[AB]_\d_\d|[AB]_ORDER|SPCTS[CO][XYZ]|MIDUTC|STARTUTC|TRGFOV\w*|)$/.test(key)));
  assert.throws(() => llorriHeaderCamera(two, kernels, bodyId), /several targets \(DONALDJOHANSON, SELAM\)/);
  assert.equal(llorriHeaderCamera(two, kernels, bodyId, 'DONALDJOHANSON').target, 'DONALDJOHANSON');
  assert.throws(() => llorriHeaderCamera(two, kernels, bodyId, 'DINKINESH'), /not in the frame's field of view/);
});
