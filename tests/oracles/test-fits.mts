#!/usr/bin/env node
/** Focused FITS gate; optional restoration is limited to this suite's pinned inputs. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readOracleFixture, readOracleInput, verifyOracleBytes, ORACLE_ROOT } from '@cssearth/core/oracle';
import { fitsArchiveInputs } from '../../packages/bake/src/objects/layers/observation/fixtures/fits/archive-inputs.mts';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const args = process.argv.slice(2);
if (args.some(arg => !['--unit', '--restore'].includes(arg)) || args.includes('--unit') && args.includes('--restore'))
  throw new Error('Usage: pnpm test:fits [--unit | --restore]');
// node --test skips a listed file that does not exist without failing, so a moved or deleted test would silently drop out.
const requireListed = (paths: readonly string[]) => {
  const missing = paths.filter(path => path.endsWith('.mts') && !existsSync(resolve(ORACLE_ROOT, path)));
  if (missing.length) throw new Error(`Listed FITS tests do not exist:\n${missing.join('\n')}`);
};
const run = (args: string[], command = process.execPath) => {
  if (command === process.execPath && args[0] === '--test') requireListed(args);
  const result = spawnSync(command, args, { cwd: ORACLE_ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
// The reader's own behaviour tests, including the float32 transport image, are the package's.
run(['--filter', '@cssearth/fits', 'test'], 'pnpm');
const unit = ['tests/oracles/fits/core.oracle.test.mts', 'tests/oracles/fits/sky-orientation.oracle.test.mts', 'tests/oracles/fits/sky-projection.oracle.test.mts',
  'tests/oracles/fits/file-region.oracle.test.mts', 'packages/bake/src/objects/layers/observation/fixtures/fits/rice.oracle.test.mts', 'tests/fits/repository-inputs.test.mts',
  'packages/telescope-cli/src/archives/interferometry/fits-table.oracle.test.mts', 'packages/bake/src/objects/color/color-transfer.oracle.test.mts', 'packages/bake/src/objects/raster/wise-atlas-mosaic.oracle.test.mts',
  'packages/bake/src/objects/raster/wise-atlas-mosaic.test.mts', 'tests/objects/observation/sky-band-composite.test.mts', 'packages/telescope-cli/src/archives/jwst/imaging/imaging.test.mts', 'tests/contract/oracle-fixtures.test.mts',
  "packages/bake/src/objects/raster/observed/observed-fits.test.mts",
  "packages/bake/src/objects/layers/terrestrial/missions/encounter-fits.test.mts",
  "packages/bake/src/objects/raster/fits-image-map.test.mts",
  "packages/bake/src/objects/raster/facet-scalars.test.mts",
  "packages/bake/src/objects/raster/obj-uv-fits.test.mts",
  "packages/bake/src/objects/layers/terrestrial/missions/pds4-geometry-cube.test.mts"];
run(['--test', '--test-concurrency=1', ...unit]);
run(['labs/nebula/run.mts', 'test', 'getsf', 'sampled-prior', 'ownership', 'source-pin']);
if (args.includes('--unit')) process.exit(0);

const inputs = new Map<string, { path: string; bytes?: number }>();
for (const name of ['fits/encounter.json', 'fits/llorri.json', 'fits/charon-leisa.json', 'fits/synoptic.json', 'fits/pallas.json', '../../packages/bake/src/objects/layers/terrestrial/missions/dart-draco-cube.json'])
  for (const input of (await readOracleFixture(name)).inputs) inputs.set(input.path, input);
for (const id of ['didymos', 'dimorphos', 'arrokoth', 'pluto']) {
  const source = resolve(ORACLE_ROOT, 'src/objects', id, 'source');
  const manifest = requireRecord(JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8')));
  const wanted = new Set<string>();
  if (id === 'didymos' || id === 'dimorphos') {
    const config = requireRecord(JSON.parse(await readFile(resolve(source, 'preparation/terrestrial.json'), 'utf8')));
    for (const entry of requireArray(requireRecord(config.raster).scientific).map(value => requireRecord(value))) if (entry.id === 'albedo') {
      wanted.add(requireString(entry.path)); wanted.add(requireString(requireRecord(entry.facetField).path));
    }
  }
  for (const value of [...requireArray(manifest.inputs), ...requireArray(manifest.documents)]) {
    const entry = requireRecord(value), path = requireString(entry.path);
    if (!wanted.has(path) && !(id === 'pluto' && /\.fits$/u.test(path)) &&
        !(id === 'arrokoth' && /\.(?:obj|fits?|png)$/u.test(path))) continue;
    const full = `src/objects/${id}/source/${path}`;
    inputs.set(full, { path: full });
  }
}
// Verify before each decoder's own byte-bound comparisons. Corruption never triggers a refresh.
const missing: { path: string; bytes?: number }[] = [];
for (const input of inputs.values()) {
  try { await readOracleInput(input); }
  catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Missing FITS oracle input')) throw error;
    missing.push(input);
  }
}
if (missing.length && !args.includes('--restore')) throw new Error(
  `${missing.length} missing FITS test inputs. ` +
  'Run pnpm build:preparation, then pnpm test:fits --restore. For the offline checks only, use pnpm test:fits --unit.\n' + missing.map(i => i.path).join('\n'));
if (missing.length) {
  const { executeAcquisition, parseAcquisitionPlan } = await import('@cssearth/bake/objects/acquisition');
  const { parseSourceManifest } = await import('@cssearth/bake/objects/sources');
  for (const input of missing) {
    if (input.path.startsWith('.local/fits-reference/')) {
      const pin = (await fitsArchiveInputs()).find(pin => pin.path === input.path);
      if (!pin) throw new Error(`Missing archive test pin: ${input.path}`);
      console.log(`Restoring test-only ${input.path} (${pin.bytes} bytes)`);
      const response = await fetch(pin.url, { headers: pin.headers, signal: AbortSignal.timeout(60_000) });
      if (!response.ok || !response.body) throw new Error(`FITS test archive returned ${response.status}: ${pin.url}`);
      const chunks: Uint8Array[] = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > pin.bytes) throw new Error(`Oversized FITS test archive response: ${pin.path}`);
        chunks.push(chunk);
      }
      const bytes = verifyOracleBytes(pin, Buffer.concat(chunks)), destination = resolve(ORACLE_ROOT, pin.path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes, { flag: 'wx' });
      await readOracleInput(input);
      continue;
    }
    const match = /^src\/objects\/([^/]+)\/source\/(.+)$/u.exec(input.path);
    if (!match) throw new Error(`Cannot download a checked-in fixture: ${input.path}`);
    const sourceRoot = resolve(ORACLE_ROOT, 'src/objects', match[1], 'source');
    const manifest = parseSourceManifest(JSON.parse(await readFile(resolve(sourceRoot, 'manifest.json'), 'utf8')), match[1]);
    console.log(`Restoring ${input.path}${input.bytes === undefined ? "" : ` (${Math.ceil(input.bytes / 1048576)} MiB)`}`);
    const plan = parseAcquisitionPlan(JSON.parse(await readFile(resolve(sourceRoot, 'preparation/acquisition.json'), 'utf8')));
    const operations = plan.operations.filter(step => 'path' in step && step.path === match[2]);
    if (!operations.length) throw new Error(`No authored restoration for ${input.path}.`);
    await executeAcquisition({ sourceRoot, manifest, plan: { ...plan, operations: operations.map(step => ({ ...step, groups: ['fits-test'] })) }, group: 'fits-test' });
    await readOracleInput(input);
  }
}
run(['--test', '--test-concurrency=1',
  'tests/oracles/fits/synoptic.test.mts',
  'tests/oracles/fits/pallas.test.mts',
  'packages/bake/src/objects/layers/terrestrial/missions/encounter-fits.oracle.test.mts',
  'packages/bake/src/objects/layers/terrestrial/missions/llorri-geo.oracle.test.mts',
  'packages/bake/src/objects/layers/terrestrial/missions/pds4-geometry-cube.oracle.test.mts',
  'packages/bake/src/objects/layers/terrestrial/missions/new-horizons-geo.test.mts',
  'packages/bake/src/objects/layers/observation/spectral-band-maps.test.mts']);
