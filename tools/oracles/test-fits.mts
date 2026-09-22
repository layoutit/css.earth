#!/usr/bin/env node
/** Focused FITS gate; optional restoration is limited to this suite's pinned inputs. */
import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readOracleFixture, readOracleInput, verifyOracleBytes, ORACLE_ROOT } from './fixture.mts';
import { fitsArchiveInputs } from './fits/archive-inputs.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../sources/source-values.mts';

const args = process.argv.slice(2);
if (args.some(arg => !['--unit', '--restore'].includes(arg)) || args.includes('--unit') && args.includes('--restore'))
  throw new Error('Usage: pnpm test:fits [--unit | --restore]');
const run = (args: string[]) => {
  const result = spawnSync(process.execPath, args, { cwd: ORACLE_ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const unit = ['tools/fits/fits.test.mts', 'tools/fits/fits.oracle.test.mts', 'tools/fits/fits-sky.test.mts', 'tools/fits/fits-sky.oracle.test.mts', 'tools/fits/fits-sky-projection.oracle.test.mts', 'tools/fits/fits-rice.oracle.test.mts',
  'tools/objects/interferometry/fits-table.oracle.test.mts', 'tools/objects/color-transfer.oracle.test.mts', 'tools/objects/observation/wise-atlas-mosaic.oracle.test.mts',
  'tools/objects/observation/wise-atlas-mosaic.test.mts', 'tools/objects/observation/sky-band-composite.test.mts', 'tools/objects/jwst/imaging/imaging.test.mts', 'tools/contract/oracle-fixtures.test.mts',
  ...['observed-fits', 'encounter-fits', 'fits-image-map', 'facet-scalars', 'obj-uv-fits', 'pds4-geometry-cube']
    .map(name => `tools/objects/terrestrial-layers/${name}.test.mts`)];
run(['--test', '--test-concurrency=1', ...unit]);
run(['labs/nebula/run.mts', 'test', 'getsf-fits', 'getsf', 'sampled-prior', 'ownership']);
if (args.includes('--unit')) process.exit(0);

const inputs = new Map<string, { path: string; sha256: string; bytes: number }>();
for (const name of ['fits/encounter.json', 'fits/llorri.json', 'fits/charon-leisa.json', 'fits/synoptic.json', 'fits/pallas.json', 'pds/dart-draco-cube.json'])
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
    inputs.set(full, { path: full, sha256: requireString(entry.expectedSha256), bytes: requireFiniteNumber(entry.expectedBytes) });
  }
}
// Verify before each decoder's own byte-bound comparisons. Corruption never triggers a refresh.
const missing: { path: string; sha256: string; bytes: number }[] = [];
for (const input of inputs.values()) {
  try { await readOracleInput(input); }
  catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Missing FITS oracle input')) throw error;
    missing.push(input);
  }
}
if (missing.length && !args.includes('--restore')) throw new Error(
  `${missing.length} missing pinned FITS test inputs (${Math.ceil(missing.reduce((n, i) => n + i.bytes, 0) / 1048576)} MiB). ` +
  'Run pnpm build:preparation, then pnpm test:fits --restore. For the offline checks only, use pnpm test:fits --unit.\n' + missing.map(i => i.path).join('\n'));
if (missing.length) {
  const { executeAcquisition, parseAcquisitionPlan, parseSourceManifest } = await import('../objects/dist/operations.js');
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
    console.log(`Restoring ${input.path} (${Math.ceil(input.bytes / 1048576)} MiB)`);
    const plan = parseAcquisitionPlan(JSON.parse(await readFile(resolve(sourceRoot, 'preparation/acquisition.json'), 'utf8')));
    const operations = plan.operations.filter(step => 'path' in step && step.path === match[2]);
    if (!operations.length) throw new Error(`No authored restoration for ${input.path}.`);
    await executeAcquisition({ sourceRoot, manifest, plan: { ...plan, operations: operations.map(step => ({ ...step, groups: ['fits-test'] })) }, group: 'fits-test' });
    await readOracleInput(input);
  }
}
run(['--test', '--test-concurrency=1',
  'tools/fits/fits-products.test.mts',
  'tools/fits/fits-pallas.test.mts',
  'tools/objects/terrestrial-layers/encounter-fits.oracle.test.mts',
  'tools/objects/terrestrial-layers/llorri-geo.oracle.test.mts',
  'tools/objects/terrestrial-layers/pds4-geometry-cube.oracle.test.mts',
  'tools/objects/terrestrial-layers/new-horizons-geo.test.mts',
  'tools/objects/observation/spectral-band-maps.test.mts',
  'tests/objects/unit/pluto/leisa.test.mts', 'tests/objects/unit/arrokoth/source.test.mts',
  'tests/objects/unit/didymos/albedo.test.mts', 'tests/objects/unit/dimorphos/albedo.test.mts']);
