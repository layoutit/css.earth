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
      assert.equal(hash(actual.sky), oracle[id].sky);
      assert.equal(hash(actual.sun), oracle[id].sun);
      assert.equal(hash(actual.markers), oracle[id].markers);
      for (const name of ['sky.json', 'sun.json', 'markers.json']) assert.ok((await readFile(resolve(outputDirectory, name))).byteLength > 2, name);
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
