import { userRootEntries } from '../test-support/index.mts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test, { mock } from 'node:test';
import * as core from '@cssearth/telescope-core/node';
import type { DiscoveredObservation } from './discovery.mts';
import type { AcquisitionSpec } from './access.mts';

const fits = await readFile(new URL('./fixtures/telescope-vo/eso-circle.fits', import.meta.url));
let transfers = 0;
mock.module('@cssearth/telescope-core/node', { namedExports: { ...core, astroquery: async (request: core.AstroqueryRequest): Promise<core.AstroqueryAnswer> => {
  assert.equal(request.operation, 'vo-download');
  if (request.operation !== 'vo-download') throw new Error('Not a download');
  transfers++;
  await writeFile(request.destination, fits, { flag: 'wx' });
  return { schema: 'cssearth-astroquery-answer@2', operation: 'vo-download', astroquery: '0.4.11', transfer: {
    file: { path: request.destination, bytes: fits.length }, effectiveUrl: request.url, contentType: 'application/fits', etag: null, lastModified: null } };
} } });
const { acquireVoProduct, acquisitionIdentity, acquisitionName } = await import('./access.mts');
test('the VO owner acquires and reuses exactly one science file inside a run; user root stays empty', async () => {
  const cwd = await mkdtemp(resolve(tmpdir(), 'vo-run-storage-')), directory = resolve(cwd, 'telescope-runs/betelgeuse-fixture/pick-1');
  const initial = await userRootEntries();
  try {
    const metadata = resolve(cwd, 'metadata.xml'); await writeFile(metadata, '<VOTABLE/>');
    const observation: DiscoveredObservation = { key: 'fixture', snapshot: 'fixture', service: 'https://archive.example/tap', table: 'ivoa.obscore',
      facility: null, collection: null, telescopeName: null, instrument: null, identities: { obs_publisher_did: 'fixture' },
      target: { status: 'confirmed', target: 'betelgeuse', reason: 'fixture' }, rawTarget: 'Betelgeuse', kind: 'image', productType: null,
      familyEvidence: { schema: 'cssearth-observation-family-evidence@1', families: ['F01'], status: 'mapped', sourceTerm: 'image', vocabulary: 'IVOA product-type', vocabularyVersion: '1.1', owner: { kind: 'archive-adapter', id: 'fixture', evidence: 'fixture' } },
      calibration: { scheme: 'ivoa', token: null }, wavelengthsMicrometres: [null, null], startIso: null, endIso: null,
      spatial: { frame: null, description: null, coordinates: {} }, access: { url: 'https://archive.example/science.fits', mime: 'application/fits', estimatedKilobytes: fits.length / 1000 }, issues: [] };
    const operation: AcquisitionSpec['operation'] = { kind: 'direct', url: observation.access.url!, parameters: {} }, request = { target: 'betelgeuse' }, limits = core.parseLimits();
    const spec: AcquisitionSpec = { schema: 'cssearth-vo-acquisition@1', key: acquisitionName(observation, operation, request), identity: acquisitionIdentity('fixture', operation, request, null, limits),
      productKey: 'fixture', observation, request, operation, descriptor: null, metadata: [{ path: metadata, bytes: 10 }], serviceRow: null, serviceMetadata: null, format: 'fits', decoder: 'fits-raster', kind: 'image', limits };
    await mkdir(directory, { recursive: true });
    const first = await core.withAcquisitionDirectory(directory, () => acquireVoProduct(cwd, spec));
    assert.ok(first.file?.startsWith(directory + '/')); assert.ok(first.record.startsWith(directory + '/'));
    assert.deepEqual(await readFile(first.file!), fits);
    assert.equal((await core.withAcquisitionDirectory(directory, () => acquireVoProduct(cwd, spec))).reused, true);
    assert.equal(transfers, 1);
    const names = await readdir(directory, { recursive: true });
    assert.equal((await Promise.all(names.filter(name => name.endsWith('.fits')).map(async name => (await stat(resolve(directory,name))).isFile()))).filter(Boolean).length, 1);
    assert.deepEqual(await userRootEntries(), initial);
    await writeFile(first.file!, fits.subarray(0, 40));
    await assert.rejects(core.withAcquisitionDirectory(directory, () => acquireVoProduct(cwd, spec)), /files changed/u);
    assert.equal(transfers, 1, 'A completed record with altered bytes is refused before transport');
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
