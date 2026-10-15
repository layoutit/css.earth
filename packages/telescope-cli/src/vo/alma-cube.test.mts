import '../test-support/index.mts';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import * as core from '@cssearth/telescope-core/node';
import type { DiscoverySnapshot } from '@cssearth/objects';
import { normalizeSnapshot, SERVICES } from './discovery.mts';
import { image } from '../previews/test-support.mts';
import { matchesAlmaCube } from './alma-cube.mts';
import { exploreChoice } from '../tui/fixtures/explore.mts';

const test = sourceTest();
const downloads: core.AstroqueryRequest[] = [];
const cube = image([5, 5, 3, 1], Array.from({ length: 75 }, (_, i) => i % 25 === 12 ? 10 : 1),
  [['OBJECT', 'Betelgeuse'], ['CTYPE3', 'FREQ'], ['CUNIT3', 'Hz'], ['CRVAL3', 211e9], ['CDELT3', 1e9], ['CRPIX3', 1], ['BUNIT', 'Jy/beam']]);
mock.module('@cssearth/telescope-core/node', { namedExports: { ...core, astroquery: async (request: core.AstroqueryRequest): Promise<core.AstroqueryAnswer> => {
  if (request.operation !== 'vo-download') return core.astroquery(request);
  downloads.push(request);
  await writeFile(request.destination, cube);
  return { schema: 'cssearth-astroquery-answer@2', operation: 'vo-download', astroquery: '0.4.11', transfer: {
    file: { path: request.destination, bytes: cube.length }, effectiveUrl: request.url, contentType: 'image/fits', etag: null, lastModified: null } };
} } });
const { planAccess } = await import('./access.mts');
const { qualifyVoProduct } = await import('./qualify.mts');
const { explorationDownloadSize } = await import('../tui/explore-services.mts');
const member = 'uid://A001/X1465/X1a15', observationId = `${member}.source.Betelgeuse.spw.23`;
const fixtures = resolve(import.meta.dirname, '../previews/fixtures');
const recordedMember = await readFile(resolve(fixtures, 'alma-member.xml'), 'utf8');
const recordedProducts = await readFile(resolve(fixtures, 'alma-products.xml'), 'utf8');
// The recorded document contains continuum products. Only the science filename and its advertised size are synthetic.
const cubeProducts = recordedProducts.replaceAll('spw23_25_27_29.mfs.I.manual.image', 'spw23.cube.I')
  .replace('<TD>image/fits</TD>\n            <TD />', '<TD>image/fits</TD>\n            <TD>5760</TD>');
const directProducts = cubeProducts.replace(/<TR>\s*<TD>[^<]*<\/TD>\s*<TD \/>\s*<TD>SODA\.([^<]+)<\/TD>/u,
  '<TR><TD>$1</TD><TD>https://almascience.eso.org/dataPortal/opaque-file</TD><TD />');

test('cube binding rejects another member, target, calibrator and spectral window', () => {
  const id = 'member.uid___A001_X1465_X1a15.Betelgeuse_sci.spw23.cube.I.pbcor.fits';
  assert.equal(matchesAlmaCube(observationId, id), true);
  for (const other of [id.replace('X1a15', 'X1a16'), id.replace('Betelgeuse_sci', 'J0510p1800_bp'), id.replace('spw23', 'spw25'), id.replace('.cube.', '.mfs.')])
    assert.equal(matchesAlmaCube(observationId, other), false);
});

test('recorded nested DataLink selects only the row cube, qualifies it, and keeps tar fallback without it', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'alma-cube-'));
  try {
    const parse = async (name: string, text: string, url: string) => {
      const file = resolve(root, name); await writeFile(file, text);
      return (await core.astroquery({ operation: 'vo-parse', file, url, byteLimit: 1e6 })).vo!;
    };
    const profile = SERVICES.find(service => service.service === 'https://almascience.eso.org/tap')!;
    const response = (await core.astroquery({ operation: 'vo-parse', file: resolve(import.meta.dirname, 'fixtures/telescope-vo/alma-obscore.xml'), url: profile.service, byteLimit: 1e6 })).vo!;
    const snapshot: DiscoverySnapshot = { schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model,
      request: { target: 'betelgeuse' }, query: 'fixture', scope: 'fixture', sampleLimit: 2, response: { ...response, rows: response.rows.map((row, index) => index === 0 ? { ...row, obs_id: observationId, access_url: `https://almascience.org/datalink/sync?ID=${member}` } : row) }, completeness: 'bounded-sample' };
    const target = { id: 'betelgeuse', names: ['Betelgeuse'] };
    const normalized = normalizeSnapshot(snapshot, profile, target, [target])[0]!;
    const observation = { ...normalized, identities: { ...normalized.identities, obs_id: observationId },
      access: { url: `https://almascience.org/datalink/sync?ID=${member}`, mime: 'application/x-votable+xml;content=datalink', estimatedKilobytes: null } };
    const links = await parse('member.xml', recordedMember, observation.access.url);
    const products = await parse('products.xml', cubeProducts, 'https://almascience.eso.org/datalink/sync?ID=products.tar');
    const loader = async (url: string) => new URL(url).searchParams.get('ID') === member ? links : products;
    const plan = await planAccess(root, observation, snapshot, { target: target.id }, loader);
    const savedSnapshot = resolve(root, 'snapshot.json'); await writeFile(savedSnapshot, JSON.stringify(snapshot));
    const choice = { ...exploreChoice, target: target.id, archiveService: profile.service, observation: observation.key,
      configuration: { kind: 'archive-acquisition' as const, key: 'cube', request: { target: target.id } },
      reference: { kind: 'vo-acquisition' as const, acquisitionKey: 'cube', observation: observation.key, snapshot: savedSnapshot } };
    assert.deepEqual(await explorationDownloadSize(choice, new AbortController().signal, undefined, loader), { bytes: 5760, singleCube: true });
    const savedXml = resolve(root, 'observation.xml');
    await writeFile(savedXml, (await readFile(resolve(import.meta.dirname, 'fixtures/telescope-vo/alma-obscore.xml'), 'utf8'))
      .replace('uid://A001/X360d/Xae.source.Betelgeuse.spw.25', observationId)
      .replace('https://almascience.org/datalink/sync?ID=uid://A001/X360d/Xae', observation.access.url));
    assert.deepEqual(await explorationDownloadSize({ ...choice, reference: { ...choice.reference, snapshot: savedXml } }, new AbortController().signal, undefined, loader),
      { bytes: 5760, singleCube: true }, 'saved raw XML and parsed snapshots select the same cube');
    assert.equal(plan.products.length, 1, plan.issues.join('\n'));
    const selected = plan.products[0]!;
    assert.equal(selected.format, 'fits'); assert.equal(selected.kind, 'cube');
    assert.equal(selected.operation.kind, 'soda-sync'); assert.deepEqual(selected.operation.parameters, {});
    assert.match(new URL(selected.operation.url).searchParams.get('ID')!, /Betelgeuse_sci\.spw23\.cube\.I\.pbcor\.fits$/u);
    assert.equal(new URL(selected.operation.url).searchParams.has('CIRCLE'), false);
    assert.ok(selected.metadata.some(pin => pin.path === products.raw.path));
    downloads.length = 0;
    const qualified = await core.withAcquisitionDirectory(resolve(root, 'pick-1'), () => qualifyVoProduct(root, selected));
    assert.equal(qualified.facts.kind, 'cube'); assert.equal(qualified.facts.verified, true);
    assert.deepEqual(await readFile(qualified.product), cube);
    const downloaded = downloads.at(-1);
    assert.equal(downloaded?.operation, 'vo-download');
    if (downloaded?.operation !== 'vo-download') throw new Error('No full-file transfer.');
    assert.equal(downloaded.url, selected.operation.url); assert.deepEqual(downloaded.parameters, {});
    assert.equal(downloaded.descriptor?.file.path, products.raw.path);
    const direct = await parse('direct.xml', directProducts, products.effectiveUrl);
    const directPlan = await planAccess(root, observation, snapshot, { target: target.id }, async url => new URL(url).searchParams.get('ID') === member ? links : direct);
    assert.deepEqual(await explorationDownloadSize(choice, new AbortController().signal, undefined, async url => new URL(url).searchParams.get('ID') === member ? links : direct), { bytes: 5760, singleCube: true });
    assert.equal(directPlan.products.length, 1); assert.equal(directPlan.products[0]?.format, 'fits');
    assert.equal(directPlan.products[0]?.operation.url, 'https://almascience.eso.org/dataPortal/opaque-file');
    const directRow = direct.rows.find(row => row.access_url === 'https://almascience.eso.org/dataPortal/opaque-file');
    assert.ok(directRow);
    const combined = { ...products, rows: [...products.rows, { ...directRow, content_length: 11520 }] };
    assert.deepEqual(await explorationDownloadSize(choice, new AbortController().signal, undefined,
      async url => new URL(url).searchParams.get('ID') === member ? links : combined), { bytes: 11520, singleCube: true }, 'confirmation shares the planner preference for direct FITS over SODA');
    const genericMime = { ...products, rows: products.rows.map(row => ({ ...row, content_type: 'application/octet-stream' })) };
    assert.deepEqual(await explorationDownloadSize(choice, new AbortController().signal, undefined,
      async url => new URL(url).searchParams.get('ID') === member ? links : genericMime), { bytes: 5760, singleCube: true }, 'a bound ALMA SODA descriptor selects the cube even without a FITS MIME label');
    const noSize = { ...products, rows: products.rows.map(row => ({ ...row, content_length: null })) };
    const noSizeLoader = async (url: string) => new URL(url).searchParams.get('ID') === member ? links : noSize;
    const head: typeof fetch = async (input, init) => {
      assert.equal(String(input), selected.operation.url); assert.equal(init?.method, 'HEAD');
      return new Response(null, { headers: { 'content-length': '12345' } });
    };
    assert.deepEqual(await explorationDownloadSize(choice, new AbortController().signal, head, noSizeLoader), { bytes: 12345, singleCube: true });
    assert.deepEqual(await explorationDownloadSize(choice, new AbortController().signal, async () => { throw new Error('No HEAD'); }, noSizeLoader),
      { bytes: null, singleCube: true }, 'missing size must not change the selected scope');
    for (const changed of [recordedProducts, cubeProducts.replaceAll('spw23.cube', 'spw25.cube')]) {
      const other = await parse('other.xml', changed, products.effectiveUrl);
      const fallback = await planAccess(root, observation, snapshot, { target: target.id }, async url => new URL(url).searchParams.get('ID') === member ? links : other);
      assert.deepEqual(await explorationDownloadSize(choice, new AbortController().signal, undefined, async url => new URL(url).searchParams.get('ID') === member ? links : other), { bytes: 401419264, singleCube: false });
      assert.equal(fallback.products.length, 1); assert.equal(fallback.products[0]?.format, 'tar');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
