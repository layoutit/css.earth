import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { inspectMappedPdsProduct } from './discover.mts';

test('a mapped multiband PDS label becomes one product-level observation without filling its wavelength gaps', async () => {
  const path = resolve(import.meta.dirname, '../../../src/objects/charon/source/observations/nh_charon_color_mosaic.lblx');
  const bytes = await readFile(path), labelUri = 'https://example.test/nh_charon_color_mosaic.lblx';
  const result = inspectMappedPdsProduct({ lid: 'urn:nasa:pds:nh_derived:plutosystem_composition:nh_charon_color_mosaic',
    lidvid: 'urn:nasa:pds:nh_derived:plutosystem_composition:nh_charon_color_mosaic::1.0', version: '1.0',
    targetNames: ['(134340) Pluto I (Charon)'], targetLids: ['urn:nasa:pds:context:target:satellite.134340_pluto.charon'],
    observingSystem: ['New Horizons', 'Multispectral Visible Imaging Camera'], startIso: '1965-01-01T00:00:00.000Z', stopIso: '3000-01-01T00:00:00.000Z',
    harvestIso: '2025-07-25T20:28:16Z', label: { uri: labelUri, bytes: bytes.byteLength, md5: createHash('md5').update(bytes).digest('hex') },
    data: [{ uri: 'https://example.test/nh_charon_color_mosaic.img', bytes: 116006912, md5: 'a'.repeat(32) }] }, bytes.toString('utf8'), createHash('sha256').update(bytes).digest('hex'))!;
  assert.deepEqual(result.wavelengthIntervalsMicrometres, [[0.875, 0.915], [0.78, 0.96], [0.55, 0.7], [0.4, 0.55]]);
  assert.equal(result.surfaceResolutionKm, 1);
  assert.equal(result.mode, 'MVIC mapped color');
});
