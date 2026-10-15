import '../test-support/index.mts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { mock } from 'node:test';
import { sourceTest } from '@cssearth/objects/node/source-test';
import * as core from '@cssearth/telescope-core/node';
import type { AcquisitionSpec } from './access.mts';
import type { DiscoveredObservation } from './discovery.mts';

const test = sourceTest();
let archive = '', transfers = 0;
mock.module('@cssearth/telescope-core/node', { namedExports: { ...core, astroquery: async (request: core.AstroqueryRequest): Promise<core.AstroqueryAnswer> => {
  if (request.operation !== 'vo-download') throw new Error('Fixture permits only download transport');
  transfers++;
  await copyFile(archive, request.destination);
  // The real origin-record write will fail, after the real extractor and science alias have succeeded.
  await mkdir(resolve(dirname(request.destination), 'origin.json'));
  return { schema: 'cssearth-astroquery-answer@2', operation: 'vo-download', astroquery: '0.4.11', transfer: {
    file: { path: request.destination, bytes: (await stat(archive)).size }, effectiveUrl: request.url,
    contentType: request.format === 'zip' ? 'application/zip' : 'application/x-tar', etag: null, lastModified: null } };
} } });
const { acquireVoProduct, acquisitionIdentity, acquisitionName } = await import('./access.mts');

for (const format of ['tar', 'zip'] as const) test(`retained ${format} retries real extraction after a record-write failure without downloading again`, async () => {
  const toolchain = await core.astroqueryToolchain();
  const root = await mkdtemp(resolve(tmpdir(), 'vo-access-retry-')), directory = resolve(root, 'pick-1'), work = resolve(root, 'work');
  transfers = 0;
  try {
    archive = resolve(root, `input.${format}`);
    const fits = resolve(import.meta.dirname, 'fixtures/telescope-vo/eso-circle.fits');
    execFileSync(toolchain.python, ['-c', `import sys, tarfile, zipfile
kind, source, destination = sys.argv[1:]
if kind == 'zip':
    with zipfile.ZipFile(destination, 'w') as package: package.write(source, 'image.fits')
else:
    with tarfile.open(destination, 'w') as package: package.add(source, arcname='image.fits')
`, format, fits, archive]);
    const metadata = resolve(root, 'metadata.xml'); await writeFile(metadata, '<VOTABLE/>');
    const observation: DiscoveredObservation = { key: 'fixture', snapshot: 'fixture', service: 'https://archive.example/tap', table: 'ivoa.obscore',
      facility: null, collection: null, telescopeName: null, instrument: null, identities: { obs_publisher_did: 'fixture' },
      target: { status: 'confirmed', target: 'star', reason: 'fixture' }, rawTarget: 'Star', kind: 'image', productType: null,
      familyEvidence: { schema: 'cssearth-observation-family-evidence@1', families: ['F01'], status: 'mapped', sourceTerm: 'image', vocabulary: 'fixture', vocabularyVersion: '1', owner: { kind: 'archive-adapter', id: 'fixture', evidence: 'fixture' } },
      calibration: { scheme: 'ivoa', token: null }, wavelengthsMicrometres: [null, null], startIso: null, endIso: null,
      spatial: { frame: null, description: null, coordinates: {} }, access: { url: `https://archive.example/science.${format}`, mime: 'application/zip', estimatedKilobytes: null }, issues: [] };
    const operation: AcquisitionSpec['operation'] = { kind: 'direct', url: observation.access.url!, parameters: {} }, request = { target: 'star' }, limits = core.parseLimits();
    const spec: AcquisitionSpec = { schema: 'cssearth-vo-acquisition@1', key: acquisitionName(observation, operation, request), identity: acquisitionIdentity('fixture', operation, request, null, limits),
      productKey: 'fixture', observation, request, operation, descriptor: null, metadata: [{ path: metadata, bytes: 10 }], serviceRow: null, serviceMetadata: null, format, decoder: 'fits-raster', kind: 'image', limits };
    await mkdir(directory); await mkdir(work);
    const acquire = () => core.withAcquisitionDirectory(directory, () =>
      core.withDownloadProgress({ report: () => {}, signal: new AbortController().signal, retainPartial: true }, () => acquireVoProduct(root, spec)), work);
    await assert.rejects(acquire(), { code: 'EISDIR' });
    const staging = resolve(work, `${spec.key}.partial`), received = resolve(staging, `archive.${format}`), before = await stat(received);
    assert.deepEqual(await readFile(resolve(staging, 'members/image.fits')), await readFile(fits));
    assert.equal((await stat(resolve(staging, 'science.fits'))).ino, (await stat(resolve(staging, 'members/image.fits'))).ino);
    assert.ok((await stat(resolve(staging, 'transfer.json'))).size > 0);
    await rm(resolve(staging, 'origin.json'), { recursive: true });
    const result = await acquire();
    assert.equal(transfers, 1); assert.equal(result.reused, false);
    assert.deepEqual(await readFile(result.file!), await readFile(fits));
    const published = resolve(dirname(result.record), `archive.${format}`);
    assert.equal((await stat(published)).ino, before.ino); assert.equal((await stat(published)).mtimeMs, before.mtimeMs);
    assert.ok(await core.readProductRecord(result.record));
    assert.equal((await acquire()).reused, true); assert.equal(transfers, 1);
    await assert.rejects(stat(staging), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
