import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import sharp from 'sharp';
import { parseSourceCatalog, sourceObject, sourceResolver } from '../../src/platform/source-catalog.mts';
import { compileSourceUsage } from '../../src/platform/source-usage.mts';
import { parseAgencies, parseExplorationCatalog } from '../../src/platform/exploration-catalog.mts';
import { compileContributions } from '../../src/platform/exploration-contributions.mts';
import { productSourceIds } from '../../src/platform/object-provenance.mts';
import { prepareVolumeProvenance } from './prepare-volume-provenance.mts';

const root = resolve(import.meta.dirname, '../..');
test('one selected volume prepares without reading unrelated presentation inputs', async () => {
  const seen: string[] = [];
  const entries = await prepareVolumeProvenance({ root, objectId: 'omega-centauri', input: async path => {
    if (path.endsWith('/source/presentation.json')) assert.equal(path, 'src/objects/omega-centauri/source/presentation.json');
    seen.push(path);
    return readFile(resolve(root, path));
  } });
  assert.deepEqual(entries.map(entry => [entry.id, entry.controls.length]), [['omega-centauri', 2]]);
  assert.ok(seen.includes('src/objects/omega-centauri/source/delivery.json'));
  assert.equal(entries[0]!.route, '/sun/?focus=omega-centauri');
  await assert.rejects(prepareVolumeProvenance({ root, objectId: 'absent-test-volume' }), /No volume presentation/);
});

test('all installed volume lenses retain real source-to-product edges', async () => {
  const closure = new Set<string>();
  const entries = await prepareVolumeProvenance({ root, input: async path => { closure.add(path); return readFile(resolve(root, path)); } });
  assert.deepEqual(entries.map(entry => [entry.id, entry.controls.length]), [
    ['betelgeuse-shell', 4], ['hd-181327-disc', 1], ['helix', 3], ['lmc', 3], ['m1', 6], ['m2-9', 1], ['m31', 1], ['m33', 1], ['m42', 2], ['m45', 5], ['m8', 3], ['omega-centauri', 2], ['pds-70-disc', 1], ['smc', 5], ['sun-cor1-density', 1],
  ]);
  assert.equal(entries.find(entry => entry.id === 'm45')?.defaultLens, 'optical-composite');
  assert.ok([...closure].every(path => !path.startsWith('.local/') && !path.endsWith('/prepared/lenses.json')));
  const sourceFiles = await readdir(resolve(root, 'src/sources'));
  const sources = sourceResolver(parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records: await Promise.all(sourceFiles.filter(path => path.endsWith('.json')).map(async path => JSON.parse(await readFile(resolve(root, 'src/sources', path), 'utf8')))) }));
  const agencies = parseAgencies(JSON.parse(await readFile(resolve(root, 'site/source/agency-logos.json'), 'utf8')));
  const catalog = parseExplorationCatalog(JSON.parse(await readFile(resolve(root, 'site/source/facilities/catalog.json'), 'utf8')), agencies, sources);
  const usage = compileSourceUsage(entries, sources), graph = compileContributions(entries, catalog);
  for (const entry of entries) {
    assert.equal(entry.provenance.basis, 'recovered');
    assert.equal(entry.route, entry.hostedBy ? `/${entry.hostedBy.objectId}/` : `/sun/?focus=${entry.id}`);
    assert.ok(entry.controls.some(control => control.id === entry.defaultLens));
    for (const control of entry.controls) {
      assert.notEqual(control.title, control.label);
      assert.notEqual(control.title, control.description);
      assert.notEqual(control.title, control.summary);
      const product = entry.provenance.products.find(product => product.lensIds?.includes(control.id));
      assert.ok(product);
      const inputs = productSourceIds(entry.provenance, product.id);
      const own = entry.provenance.sources.find(source => source.lensId === control.id);
      assert.ok(own && inputs.includes(own.id));
      const uses = (usage.byObject[entry.id] ?? []).map(index => usage.edges[index])
        .filter(use => use.consumerKind === 'object-product' && use.lensIds.includes(control.id));
      assert.ok(uses.some(use => use.localSourceId === own.id));
      for (const input of product.inputs) {
        const source = entry.provenance.sources.find(source => source.id === input);
        if (source?.sourceBinding?.kind === 'catalogued') {
          assert.ok(uses.some(use => use.localSourceId === input), `${entry.id}/${control.id}: ${input} retains its source edge`);
        }
      }
      const output = entry.outputs.find(output => output.path.endsWith(control.thumbnailUrl));
      assert.ok(output && output.text instanceof Uint8Array);
      const image = await sharp(output.text).metadata();
      assert.equal(image.format, 'webp');
      assert.ok(image.width && image.width <= 768 && image.height && image.height <= 768);
      assert.deepEqual([control.texture?.width, control.texture?.height], [image.width, image.height]);
    }
  }
  const m45 = entries.find(entry => entry.id === 'm45')!;
  assert.equal(m45.provenance.products.find(p => p.id === 'noirlab-optical')?.inputEvidence?.find(e => e.sourceId === 'distance')?.role, 'placement');
  // A lens may name further inputs of its own: the SiO lens is read about the star that the continuum image locates.
  const sio = entries.find(entry => entry.id === 'betelgeuse-shell')!.provenance.products.find(p => p.id === 'sio-2023')!;
  assert.deepEqual(sio.inputEvidence?.map(e => [e.sourceId, e.role]), [['alma-sio-v0-5-4-2023-08', 'appearance'], ['alma-continuum-2023-08', 'registration']]);
  assert.ok(sio.inputs.includes('alma-continuum-2023-08'));
  const cor1 = entries.find(entry => entry.id === 'sun-cor1-density')!;
  assert.equal(cor1.hostedBy?.datasets['electron-density']?.lensId, 'cor1-density');
  // A volume attached to a body is no place: each lens is reached through the body's dataset that shows it.
  const shell = entries.find(entry => entry.id === 'betelgeuse-shell')!;
  assert.deepEqual(Object.fromEntries(Object.entries(shell.hostedBy!.datasets).map(([lens, dataset]) => [lens, dataset.lensId])),
    { 'emission-2020': 'matisse', 'zimpol-v': 'dust-2024', 'veil-2019-12': 'dust-2019', 'sio-2023': 'sio-2023' });
  const hosted = usage.datasets.filter(dataset => dataset.objectId === 'betelgeuse-shell');
  assert.deepEqual(hosted.map(dataset => [dataset.lensId, dataset.href]).sort(), [['emission-2020', '/betelgeuse/?dataset=matisse'],
    ['sio-2023', '/betelgeuse/?dataset=sio-2023'], ['veil-2019-12', '/betelgeuse/?dataset=dust-2019'], ['zimpol-v', '/betelgeuse/?dataset=dust-2024']]);
  assert.ok(hosted.every(dataset => dataset.host?.objectId === 'betelgeuse'));
  const observationEdge = graph.edges.find(e => e.objectId === 'm45' && e.productId === 'noirlab-optical' && e.sourceId === 'noirlab-optical')!;
  assert.deepEqual(observationEdge.roles, ['appearance']);
  assert.equal(observationEdge.observation?.id, 'noao-m45');
  assert.equal(observationEdge.observation?.observedAt, null);
  assert.equal(observationEdge.observation?.instrument, null);
  const helix = entries.find(entry => entry.id === 'helix');
  assert.ok(helix);
  for (const product of helix.provenance.products) assert.ok(product.inputs.includes('hco-components'));
  const lmc = entries.find(entry => entry.id === 'lmc');
  assert.ok(lmc);
  for (const product of lmc.provenance.products) for (const id of ['density-prior', 'catalogue-stars', 'sky-registration']) assert.ok(product.inputs.includes(id));
  const hubble = graph.edges.filter(edge => edge.objectId === 'm2-9' && edge.attribution.kind === 'facility');
  assert.ok(hubble.some(edge => edge.attribution.kind === 'facility' && edge.attribution.facilityId === 'hubble'));
  const captures = entries.flatMap(entry => entry.provenance.sources.flatMap(source => source.lensId ? (source.capture?.attributions ?? []).map(attribution => ({ objectId: entry.id, lensId: source.lensId, attribution })) : []));
  const legacyCaptures = captures.filter(capture => ['helix', 'lmc', 'm2-9', 'm42'].includes(capture.objectId));
  assert.equal(legacyCaptures.length, 9);
  assert.deepEqual(legacyCaptures.filter(capture => capture.attribution.kind === 'unresolved').map(capture => `${capture.objectId}/${capture.lensId}`), ['lmc/horalek-widefield']);
  assert.deepEqual([...new Set(legacyCaptures.flatMap(capture => capture.attribution.kind === 'facility' ? [capture.attribution.facilityId] : []))].sort(), ['eso-3-6m', 'hubble', 'mpg-eso-2-2m', 'vista', 'vst', 'wise']);
  const newEntries = entries.filter(entry => ['m1', 'm45', 'm8'].includes(entry.id));
  const newLenses = newEntries.flatMap(entry => entry.controls.map(control => `${entry.id}/${control.id}`)).sort();
  assert.equal(newLenses.length, 14);
  const newCaptures = captures.filter(capture => ['m1', 'm45', 'm8'].includes(capture.objectId));
  assert.deepEqual([...new Set(newCaptures.map(capture => `${capture.objectId}/${capture.lensId}`))].sort(), newLenses,
    'All fourteen added observations name their actual known observing equipment.');
  assert.deepEqual(newCaptures.map(capture => [
    `${capture.objectId}/${capture.lensId}`, capture.attribution.kind,
    capture.attribution.kind === 'facility' ? capture.attribution.facilityId : null,
  ]).sort((left, right) => String(left[0]).localeCompare(String(right[0]))), [
    ['m1/chandra-xray', 'facility', 'chandra'],
    ['m1/hubble-optical', 'facility', 'hubble'],
    ['m1/spitzer-infrared', 'facility', 'spitzer'],
    ['m1/vla-radio', 'facility', 'vla'],
    ['m1/webb-components', 'facility', 'webb'],
    ['m1/webb-infrared', 'facility', 'webb'],
    ['m45/noirlab-optical', 'facility', 'wiyn-0-9m'],
    ['m45/optical-composite', 'facility', 'niittee-sharpstar-61edph-iii'],
    ['m45/spitzer-irac', 'facility', 'spitzer'],
    ['m45/spitzer-irac-mips', 'facility', 'spitzer'],
    ['m45/wise-four-band', 'facility', 'wise'],
    ['m8/eso-optical', 'facility', 'mpg-eso-2-2m'],
    ['m8/eso-vista', 'facility', 'vista'],
    ['m8/spitzer-mid-infrared', 'facility', 'spitzer'],
  ]);
});

test('source-lens binding and recipe pins fail closed when their properties are removed', async () => {
  const mutations: { file: string; mutate: (value: Record<string, unknown>) => void; error: RegExp }[] = [
    { file: 'src/objects/helix/source/manifest.json', mutate(value) {
      if (!Array.isArray(value.inputs)) throw new TypeError('Missing source inputs.');
      delete sourceObject(value.inputs[0]).lensId;
    }, error: /Unbound volume lens image/ },
  ];
  for (const mutation of mutations) await assert.rejects(prepareVolumeProvenance({ root, input: async path => {
    const bytes = await readFile(resolve(root, path));
    if (path !== mutation.file) return bytes;
    const value = sourceObject(JSON.parse(bytes.toString('utf8'))); mutation.mutate(value);
    return Buffer.from(JSON.stringify(value));
  } }), mutation.error);
});

test('image-layer deliveries retain authored documents and every layer in matching runtime inventories', async () => {
  const { mkdtemp, mkdir, symlink, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { createHash } = await import('node:crypto');
  const fixture = await mkdtemp(resolve(tmpdir(), 'image-layer-provenance-'));
  try {
    await mkdir(resolve(fixture, 'src/objects'), { recursive: true });
    for (const id of ['m31', 'm33']) await mkdir(resolve(fixture, 'src/objects', id));
    for (const path of ['tools', 'site', ...['m31', 'm33'].flatMap(id => ['source', 'prepared', 'object.json'].map(name => `src/objects/${id}/${name}`))]) {
      await symlink(resolve(root, path), resolve(fixture, path));
    }
    const entries = await prepareVolumeProvenance({ root: fixture });
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.equal(entry.provenance.sources.filter(source => source.kind === 'authored-document').length, 3);
      const bank = sourceObject(JSON.parse(await readFile(resolve(root, entry.base, 'prepared/image-layers.json'), 'utf8')));
      assert.ok(Array.isArray(bank.resources));
      const rootInventory = entry.outputs.find(output => output.path === resolve(fixture, entry.base, 'inventory.json'));
      assert.ok(rootInventory, 'the inventory is published once, at the body root');
      assert.ok(!entry.outputs.some(output => output.path.endsWith('prepared/inventory.json')));
      const inventory = sourceObject(JSON.parse(String(rootInventory.text)));
      assert.ok(Array.isArray(inventory.assets));
      assert.equal(inventory.assets.length, bank.resources.length + 4);
      assert.equal(inventory.assets.filter(raw => sourceObject(raw).location === 'public').length, 1);
      for (const raw of bank.resources) {
        const resource = sourceObject(raw);
        assert.ok(entry.provenance.products[0]?.outputs.some(output => output.url === `${entry.base}/prepared/${resource.path}` && output.sha256 === resource.sha256));
      }
      for (const raw of inventory.assets) {
        const asset = sourceObject(raw);
        const path = asset.location === 'public'
          ? resolve(fixture, 'public/scenes', entry.id, String(asset.filename))
          : resolve(fixture, entry.base, 'prepared', String(asset.filename));
        const generated = entry.outputs.find(output => output.path === path);
        const bytes = generated ? Buffer.from(generated.text) : await readFile(path);
        assert.equal(asset.bytes, bytes.length);
        assert.equal(asset.sha256, createHash('sha256').update(bytes).digest('hex'));
      }
    }
    await assert.rejects(prepareVolumeProvenance({ root: fixture, input: async path => {
      const bytes = await readFile(resolve(fixture, path));
      if (path !== 'src/objects/m31/source/manifest.json') return bytes;
      const manifest = sourceObject(JSON.parse(bytes.toString()));
      assert.ok(Array.isArray(manifest.documents));
      sourceObject(manifest.documents[0]).path = 'missing/document.json';
      return Buffer.from(JSON.stringify(manifest));
    } }), /Source is missing|ENOENT/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('sky band previews read their recipe with a warm cache and compose from the archive with a cold one', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { preparePreview } = await import('./prepare-volume-provenance.mts');
  const temporary = await mkdtemp(resolve(tmpdir(), 'sky-preview-'));
  try {
    const recipe = Buffer.from(JSON.stringify({ schema: 'cssearth-sky-band-composite@1', grid: { width: 16, height: 16, fovDeg: 0.01, centerIcrsDegrees: [270.9, -24.4] },
      bands: [{ band: 'IRAC4', bytes: 2880 }], backgroundPercentile: 1, peakPercentile: 99.9, display: { minimum: 0, stretch: 0.1, softening: 8 } }));
    const composite = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#400' } }).png().toBuffer();
    const directory = '.local/nebula-lab/observations/m8-processed/sources', recipePath = 'src/objects/m8/source/sky-bands/spitzer-irac.json';
    await mkdir(resolve(temporary, directory), { recursive: true });
    const warm = { path: `${directory}/spitzer-mid-infrared.png`, skyBands: { path: recipePath } };
    await writeFile(resolve(temporary, warm.path), composite);
    const files = new Map([[recipePath, recipe]]);
    const input = async (path: string) => { const bytes = files.get(path); if (!bytes) throw new Error(`Missing recipe ${path}`); return bytes; };
    assert.equal((await preparePreview(temporary, warm, input)).width, 16);
    // The recipe is source closure whether or not the composite is cached.
    files.delete(recipePath);
    await assert.rejects(preparePreview(temporary, warm, input), /Missing recipe/);
    files.set(recipePath, recipe);
    // A cold cache composes from the survey tiles, which this test never serves.
    await assert.rejects(preparePreview(temporary, { ...warm, path: `${directory}/cold.png` }, input));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('a sky band preview is served by the object mirror instead of the survey archive', async t => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { createServer } = await import('node:http');
  const { preparePreview } = await import('./prepare-volume-provenance.mts');
  const composite = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#400' } }).png().toBuffer();
  const requests: string[] = [];
  let mirrorBehavior: 'serve' | 'miss' = 'serve';
  const server = createServer((req, res) => {
    requests.push(req.url ?? '');
    if (req.url?.startsWith('/source-cache/') && mirrorBehavior === 'serve') { res.writeHead(200); res.end(composite); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>(accept => server.close(() => accept())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const temporary = await mkdtemp(resolve(tmpdir(), 'sky-mirror-preview-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const recipe = Buffer.from(JSON.stringify({ schema: 'cssearth-sky-band-composite@1', grid: { width: 16, height: 16, fovDeg: 0.01, centerIcrsDegrees: [270.9, -24.4] },
    bands: [{ band: 'IRAC4', bytes: 2880 }], backgroundPercentile: 1, peakPercentile: 99.9, display: { minimum: 0, stretch: 0.1, softening: 8 } }));
  const directory = '.local/nebula-lab/observations/m8-processed/sources', recipePath = 'src/objects/m8/source/sky-bands/spitzer-irac.json';
  const input = async (path: string) => { if (path !== recipePath) throw new Error(`Missing recipe ${path}`); return recipe; };
  const pinFor = (name: string) => ({ path: `${directory}/${name}.png`, skyBands: { path: recipePath } });

  await t.test('mirror hit: the survey archive is never queried', async () => {
    requests.length = 0; mirrorBehavior = 'serve';
    const pin = pinFor('spitzer-mid-infrared');
    const result = await preparePreview(temporary, pin, input, { mirrorOrigin: origin });
    assert.equal(result.width, 16);
    // The composite is written from mirror bytes alone. Composing it here would need the survey tiles, which this
    // test never serves, so a lost mirror branch fails instead of silently reaching the archive.
    assert.deepEqual(requests, ['/source-cache/local/nebula-lab/observations/m8-processed/sources/spitzer-mid-infrared.png']);
    assert.equal((await readFile(resolve(temporary, pin.path))).length, composite.length);
  });

  await t.test('mirror miss: the archive is the only route left, and this test serves no tiles', async () => {
    requests.length = 0; mirrorBehavior = 'miss';
    const pin = pinFor('missing');
    await assert.rejects(preparePreview(temporary, pin, input, { mirrorOrigin: origin }));
    assert.deepEqual(requests, ['/source-cache/local/nebula-lab/observations/m8-processed/sources/missing.png']);
    await assert.rejects(readFile(resolve(temporary, pin.path)), { code: 'ENOENT' }, 'nothing is cached from a miss');
  });

  await t.test('no mirror opted in: the archive stays the only route', async () => {
    requests.length = 0; mirrorBehavior = 'serve';
    await assert.rejects(preparePreview(temporary, pinFor('no-mirror'), input));
    assert.deepEqual(requests, [], 'a caller that opted out of the mirror must not contact it');
  });
});

test('a publisher preview tries the object mirror first and falls back to the publisher URL', async t => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { createServer } = await import('node:http');
  const { preparePreview } = await import('./prepare-volume-provenance.mts');
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#048' } }).jpeg().toBuffer();
  const requests: string[] = [];
  const filename = 'archive-original.jpg';
  let mirrorBehavior: 'serve' | 'miss' = 'serve';
  const server = createServer((req, res) => {
    requests.push(req.url ?? '');
    if (req.url?.startsWith('/source-cache/')) {
      if (mirrorBehavior === 'miss') { res.writeHead(404); res.end(); return; }
      res.writeHead(200); res.end(image); return;
    }
    if (req.url === `/publisher/${filename}`) { res.writeHead(200); res.end(image); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>(accept => server.close(() => accept())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const temporary = await mkdtemp(resolve(tmpdir(), 'publisher-preview-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const input = async () => { throw new Error('No source-closure input expected for a publisher preview.'); };

  await t.test('mirror hit: the publisher is never contacted', async () => {
    requests.length = 0; mirrorBehavior = 'serve';
    const pin = { path: `.local/downloads/${filename}`, url: `${origin}/publisher/${filename}` };
    const result = await preparePreview(temporary, pin, input, { mirrorOrigin: origin });
    assert.equal(result.width, 8);
    assert.deepEqual(requests, [`/source-cache/local/downloads/${filename}`]);
    await rm(resolve(temporary, pin.path));
  });

  await t.test('mirror miss (404): falls back to the publisher URL', async () => {
    requests.length = 0; mirrorBehavior = 'miss';
    const pin = { path: `.local/downloads-2/${filename}`, url: `${origin}/publisher/${filename}` };
    const result = await preparePreview(temporary, pin, input, { mirrorOrigin: origin });
    assert.equal(result.width, 8);
    assert.deepEqual(requests, [`/source-cache/local/downloads-2/${filename}`, `/publisher/${filename}`]);
    await rm(resolve(temporary, pin.path));
  });

  await t.test('mirror and publisher both fail: the caller sees a clear error, not a silent empty result', async () => {
    requests.length = 0; mirrorBehavior = 'miss';
    const pin = { path: `.local/downloads-4/${filename}`, url: `${origin}/publisher/does-not-exist.jpg` };
    await assert.rejects(preparePreview(temporary, pin, input, { mirrorOrigin: origin }), /Preview download failed/);
  });
});
