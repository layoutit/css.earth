import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareCelestialAssets } from './index.js';

const root = process.cwd();
const oracle = JSON.parse(await readFile(resolve(root, 'tests/objects/compatibility/celestial.json'), 'utf8')) as Record<string,Record<string,string>>;
const hash = (value:unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('celestial preparation reproduces the Mercury and Venus prepared contracts', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'cssearth-celestial-'));
  try {
    for (const id of ['mercury', 'venus']) {
      const sourceDirectory = resolve(root, 'src/planets', id, 'source');
      const config = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/celestial.json'), 'utf8')) as unknown;
      const outputDirectory = resolve(scratch, id), publicDirectory = resolve(scratch, 'public', id);
      const actual = await prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, config });
      const accepted = JSON.parse(await readFile(resolve(root, 'src/planets', id, 'prepared/sky.json'), 'utf8'));
      assert.equal(hash(accepted), oracle[id].sky, 'The accepted sky contract remains pinned');
      // The older descriptor records lossless intermediate image hashes. The
      // accepted delivery fixture owns the photographic WebP bytes shipped by
      // the current preparer. Verify those bytes as well as every sky field.
      const {hashes: intermediateHashes, ...acceptedSky} = accepted;
      const {hashes: preparedHashes, ...actualSky} = actual.sky;
      assert.deepEqual(actualSky, acceptedSky);
      assert.deepEqual(Object.keys(preparedHashes).sort(), Object.keys(intermediateHashes).sort());
      const delivery = JSON.parse(await readFile(resolve(root, 'tests/objects/compatibility', `${id}-assets.json`), 'utf8'));
      for (const filename of Object.keys(preparedHashes)) {
        const expected = delivery.assets.find((asset: {filename:string})=>asset.filename===filename);
        assert.ok(expected, `Sky image lacks an accepted delivery identity: ${filename}`);
        const bytes = await readFile(resolve(publicDirectory, filename));
        assert.equal(bytes.length, expected.bytes, filename);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, filename);
      }
      assert.equal(hash(actual.sun), oracle[id].sun);
      assert.equal(hash(actual.markers), oracle[id].markers);
      for (const name of ['sky.json', 'sun.json', 'markers.json']) assert.ok((await readFile(resolve(outputDirectory, name))).byteLength > 2, name);
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
