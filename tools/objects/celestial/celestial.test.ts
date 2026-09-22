import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareCelestialAssets } from './index.js';

const root = process.cwd();

// The committed Mercury and Venus plans are this preparer's output from their pinned sources; it writes no images.
test('celestial preparation reproduces the prepared Mercury and Venus sky orientation and Sun direction', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'cssearth-celestial-'));
  try {
    for (const id of ['mercury', 'venus']) {
      const sourceDirectory = resolve(root, 'src/objects', id, 'source');
      const config = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/celestial.json'), 'utf8')) as unknown;
      const outputDirectory = resolve(scratch, id), publicDirectory = resolve(scratch, 'public', id);
      const actual = await prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, config });
      for (const name of ['sky', 'sun'] as const) {
        const written: unknown = JSON.parse(await readFile(resolve(outputDirectory, `${name}.json`), 'utf8'));
        assert.deepEqual(written, JSON.parse(JSON.stringify(actual[name])), `${id} ${name}.json`);
        assert.deepEqual(written, JSON.parse(await readFile(resolve(root, 'src/objects', id, 'prepared', `${name}.json`), 'utf8')), `${id} prepared ${name}`);
      }
      await assert.rejects(access(resolve(outputDirectory, 'markers.json')), { code: 'ENOENT' });
      await assert.rejects(access(publicDirectory), { code: 'ENOENT' });
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
