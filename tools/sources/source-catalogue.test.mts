import { sourceTestContexts as prepareContextProvenance, sourceTestVolumes as prepareVolumeProvenance,
  prepareTestFacilities as prepareFacilities, sourceTestGeneratedPaths, inventoriedPreparedPaths, sourceCheckMode } from './source-test-inputs.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { sourceInventory } from './source-catalogue-inputs.mts';
import { hasErrorCode } from './source-values.mts';
import { sourceObject, sourceArray, sourceText, parseSourceCatalog, sourceResolver } from '../../src/platform/source-catalog.mts';
import { parsePreparedSources } from '../../src/platform/prepared-sources.mts';
import { readSourceCatalog } from './read-source-catalogue.mts';
import { parsePreparedExploration } from '../../src/platform/prepared-exploration.mts';
import { compileSourceUsage, parseSourceUsage, sourceDatasetViews } from '../../src/platform/source-usage.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { explorationCompilerClosure } from '../prepare/prepare-facilities.mts';
import { refreshSourceRecord } from './source-authoring-templates.mts';
import { objectProvenanceOutputs } from '../prepare/prepare-provenance.mts';
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path,'utf8'));
const prepared = parsePreparedSources(await read('site/prepared-sources.json'));
// A temporary root holds only the catalogue's own inputs, so each body's record is built once from the real packages.
const { documents: provenance } = await objectProvenanceOutputs();
const exploration = parsePreparedExploration(await read('site/prepared-facilities.json'),prepared.sources);
// Preview originals are bounded pinned image inputs; the source graph never needs a baked volume bank.
const volumePreviewInputs = async () => {
  if (sourceCheckMode() === 'published') return [];
  const ids = new Set(prepared.usage.datasets.filter(dataset => dataset.href.startsWith('/sun/?focus=')).map(dataset => dataset.objectId));
  const paths = new Set<string>();
  for (const id of ids) {
    const presentation = sourceObject(await read(`src/objects/${id}/source/presentation.json`));
    for (const lens of sourceArray(presentation.lenses, sourceObject)) paths.add(sourceText(sourceObject(lens.preview).path));
  }
  return [...paths];
};
const volumeSourceInputs = async () => {
  if (sourceCheckMode() === 'published') return [];
  const paths = new Set<string>();
  for (const entry of await readdir('src/objects', { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let manifestValue: unknown;
    try {
      manifestValue = await read(`src/objects/${entry.name}/source/manifest.json`);
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) continue;
      throw error;
    }
    const manifest = sourceObject(manifestValue);
    if (manifest.schema !== 'cssearth-volume-source-manifest@1') continue;
    if (manifest.pathBase !== 'repository') throw new TypeError(`Invalid repository volume source manifest: ${entry.name}.`);
    for (const section of ['inputs', 'documents', 'generatedIntermediates'])
      for (const source of sourceArray(manifest[section] ?? [], sourceObject)) paths.add(sourceText(source.path));
  }
  return [...paths];
};
const sourceFixture = (id: string) => ({
  id, title: `Synthetic source ${id}`, kind: 'publication', identityLevel: 'work',
  identifiers: [{type: 'test', value: id}],
  links: [{role: 'landing', url: `https://example.invalid/${id}`, label: 'Test provider'}],
  evidence: [{url: `https://example.invalid/${id}`, checkedOn: '2026-09-10', locator: 'Test identity'}],
  relations: [], statements: [],
});

test('independent source additions merge and compile without changing shared tracked files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-source-branches-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, {cwd: root})).stdout.trim();
  await git('init', '-b', 'main');
  await git('config', 'user.name', 'Source addition test');
  await git('config', 'user.email', 'test@example.invalid');
  await git('config', 'commit.gpgsign', 'false');
  await git('config', 'core.hooksPath', '/dev/null');
  await copyFile('.gitignore', join(root, '.gitignore'));
  await mkdir(join(root, 'src/sources'), {recursive: true});
  await mkdir(join(root, 'site'), {recursive: true});
  const add = (id: string) => writeFile(join(root, `src/sources/${id}.json`), JSON.stringify(sourceFixture(id)));
  await add('existing');
  await git('add', '.'); await git('commit', '-m', 'Base source');
  const base = await git('rev-parse', 'HEAD');
  for (const id of ['new-moon-source', 'new-comet-source']) {
    await git('checkout', '-b', id, base);
    await add(id);
    const catalog = await readSourceCatalog(root);
    // Exercise the actual ignore rules with distinct derived output on each branch.
    for (const path of ['site/prepared-sources.json', 'site/prepared-facilities.json']) await writeFile(join(root, path), JSON.stringify(catalog));
    await git('add', '.'); await git('commit', '-m', `Add ${id}`);
    assert.equal(await git('diff', '--name-only', base, 'HEAD'), `src/sources/${id}.json`);
  }
  await git('checkout', 'main');
  for (const id of ['new-moon-source', 'new-comet-source']) await git('merge', '--no-edit', id);
  const catalog = await readSourceCatalog(root);
  assert.deepEqual(catalog.records.map(record => record.id), ['existing', 'new-comet-source', 'new-moon-source']);
  assert.equal(await git('status', '--porcelain'), '');
});

test('source files reject mismatched IDs and duplicate provider identities', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-source-records-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  await mkdir(join(root, 'src/sources'), {recursive: true});
  const first = 'src/sources/first.json', second = 'src/sources/second.json';
  await writeFile(join(root, first), JSON.stringify(sourceFixture('wrong')));
  await assert.rejects(readSourceCatalog(root), /identity differs from filename/);
  await writeFile(join(root, first), JSON.stringify(sourceFixture('first')));
  await writeFile(join(root, second), JSON.stringify(sourceFixture('second')));
  await readSourceCatalog(root);
  await writeFile(join(root, second), JSON.stringify({...sourceFixture('second'), identifiers: sourceFixture('first').identifiers}));
  await assert.rejects(readSourceCatalog(root), /Duplicate/);
});
const objectInput = async (id: string) => {
  const object = SCENE_OBJECTS.find(object => object.id === id)!;
  const page = sourceObject(await read(`src/objects/${id}/prepared/page.json`)), controls = sourceObject(page.controls);
  const lenses = controls.lenses === null ? [] : sourceArray(sourceObject(controls.lenses).controls, raw => {
    const lens=sourceObject(raw);return {id:sourceText(lens.id),label:sourceText(lens.label)};
  });
  return {id,name:object.name,route:object.route,base:`src/objects/${id}`,controls:lenses,provenance:validateObjectProvenance(await read(`src/objects/${id}/prepared/provenance.json`))};
};
test('source uses conserve all product dependencies, include models, and never convert metadata into observations', async () => {
  const objects = await Promise.all(SCENE_OBJECTS.map(object=>objectInput(object.id)));
  objects.push(...await prepareVolumeProvenance(), ...await prepareContextProvenance());
  const metadata=prepared.usage.edges.filter(edge=>edge.consumerKind!=='object-product');
  assert.deepEqual(compileSourceUsage(objects,prepared.sources,metadata),prepared.usage);
  assert.equal(metadata.filter(edge=>edge.kind==='shared-context').length,4);
  const artworkCount = (await Promise.all(['render','emblem'].map(async kind => sourceArray(sourceObject(await read(`site/source/facilities/${kind}-library.json`)).entries,sourceObject).length))).reduce((a,b)=>a+b,0);
  assert.equal(metadata.filter(edge=>edge.kind==='artwork').length,artworkCount);
  assert.ok(metadata.every(edge=>!edge.lensIds.length && (edge.consumerKind==='object-fact' || edge.consumerKind==='spatial-measurement' || !edge.objectId)));
  assert.equal(prepared.usage.bySource['eso-eso0932a'],undefined,'unused retained panorama creates no active use');
  assert.ok(prepared.usage.edges.filter(edge => edge.kind === 'shared-context').every(edge => edge.catalogueId !== 'hyg-v41'), 'the current shared sky uses HYG v4.4');
  assert.ok(prepared.usage.bySource['hyg-v44'].length===1);
  assert.ok(prepared.usage.edges.some(edge=>edge.objectId==='adrastea' && edge.kind==='method' && edge.lensIds.length));
  assert.ok(prepared.usage.edges.some(edge=>edge.objectId==='mercury' && edge.lensIds.includes('interior')));
  const sourceIds=['bdr','enhanced','topography'].map(term => prepared.inventory.find(row=>row.ownerPath==='src/objects/mercury/source/manifest.json' && row.localId.includes(term) && row.binding.kind==='catalogued')!.binding);
  assert.equal(new Set(sourceIds.map(binding=>JSON.stringify(binding))).size,3);
  for (const source of prepared.catalog.records) assert.equal(new Set(sourceDatasetViews(prepared.usage,source.id).map(view=>view.href)).size,sourceDatasetViews(prepared.usage,source.id).length);
});
test('new unresolved inputs, unknown bindings, stale lenses and inconsistent usage indexes fail', async () => {
  const path='src/objects/earth/source/manifest.json', manifest=sourceObject(await read(path));
  const input=sourceArray(manifest.inputs,sourceObject)[0];
  input.sourceBinding={kind:'unresolved',label:'Unknown input',evidence:'No provider record',reason:'Identity has not been established'};
  assert.throws(()=>sourceInventory(manifest,path,prepared.sources,new Set()),/Unresolved source/);
  const mercury=await objectInput('mercury');
  assert.throws(()=>compileSourceUsage([{...mercury,controls:[]}],prepared.sources),/Unknown source dataset/);
  assert.throws(()=>compileSourceUsage([mercury],{}),/Unknown canonical source/);
  const graph=structuredClone(prepared.usage); Object.assign(graph.bySource,{invented:[0]});
  assert.throws(()=>parseSourceUsage(graph,prepared.sources),/Inconsistent/);
  const invalid=structuredClone(prepared.usage);Object.assign(invalid.edges.find(edge=>edge.kind==='shared-context')!,{objectId:'earth'});
  assert.throws(()=>parseSourceUsage(invalid,prepared.sources),/Metadata citation/);
});
test('shared published identities combine usage without combining local input records', () => {
  const gaspra = prepared.sources['galileo-ssi-gll36001'];
  assert.equal(gaspra.version, '1.0');
  // Ida legitimately cites the shared camera catalog from two of its own lens datasets (calibrated, filter-color),
  // so this is object-level combination, not a duplicate: dedupe objects, don't count per-lens dataset rows.
  assert.deepEqual([...new Set(sourceDatasetViews(prepared.usage, gaspra.id).map(view => view.objectId))].sort(), ['gaspra', 'ida']);
  const localIds = prepared.usage.edges.filter(edge => edge.catalogueId === gaspra.id).map(edge => edge.localSourceId);
  assert.ok(localIds.includes('gaspra-gll36001-ti') && localIds.includes('ida-gll36001-ti'));
  const paper = prepared.sources['doi-10-3847-psj-acaf79'];
  assert.deepEqual(sourceDatasetViews(prepared.usage, paper.id).map(view => view.objectId).sort(), ['eurybates','orus']);
  assert.notEqual(prepared.sources.hyg.id, prepared.sources['hyg-v44'].id, 'a work and its release remain distinct');
});
test('refreshing document pins retains bindings and native source metadata', async () => {
  const path = 'src/objects/salacia/source/manifest.json', manifest = sourceObject(await read(path));
  const document = sourceObject(await read('src/objects/salacia/prepared/provenance.json'));
  const used = new Set(sourceArray(document.sources, sourceObject).map(source => sourceText(source.path)));
  const before = sourceInventory(manifest, path, prepared.sources, used);
  const documents = sourceArray(manifest.documents, sourceObject);
  const refreshed = documents.map(row => refreshSourceRecord(documents, {
    path: sourceText(row.path), purpose: 'Fallback for a newly authored record.',
  }));
  assert.deepEqual(sourceInventory({...manifest, documents: refreshed}, path, prepared.sources, used), before);
  const native = {path:'native.xml',kind:'source-document',origin:'https://example.org/native.xml',credit:'Provider',
    sourceBinding:{kind:'catalogued',references:[{catalogueId:'native',role:'material',evidence:'Original label'}]},
    capture:{attributions:[{kind:'mission',missionId:'test-mission',evidence:'Native label'}]},
    purpose:'Original product label.'};
  const result = refreshSourceRecord([native],{path:'native.xml',purpose:'Fallback.'});
  assert.deepEqual(result,native);
  assert.equal(refreshSourceRecord([],{path:'new.json'}).sourceBinding,undefined,'refresh must not invent a binding');
});
test(`both catalogues prepare deterministically from ${sourceCheckMode()} package inputs before publication`, async () => {
  const result=await prepareFacilities({publish:false});
  const facts = prepared.usage.edges.filter(edge => edge.consumerKind === 'object-fact');
  assert.equal(facts.length, result.factsheets.facts, 'every published fact is cited');
  assert.ok(facts.some(edge => edge.objectId === 'earth' && edge.consumerId === 'earth/radius'));
  assert.ok(facts.some(edge => edge.objectId === 'abundantia' && edge.citationUrl?.includes('/4625')));
  assert.ok(result.preparedSources.closure.includes('src/objects/earth/source/editorial/factsheet-review.json'));
  assert.ok(result.preparedSources.closure.includes('src/objects/abundantia/source/reference/damit-model.json'));
  assert.deepEqual(result.catalogueOutputs, result.outputs.slice(-2), 'catalog-only publication excludes prepared volume and R2 outputs');
  assert.deepEqual(sourceDatasetViews(prepared.usage, 'damit-models'), [], 'factsheet metadata is not a shape or imagery contribution');
  for (const output of result.outputs) assert.deepEqual(typeof output.text === 'string' ? Buffer.from(output.text) : output.text,await readFile(output.path),output.path);
  const mercury=await objectInput('mercury');
  const corrupted=structuredClone(mercury.provenance);
  const corruptedBinding=corrupted.sources.find(source=>source.sourceBinding?.kind==='catalogued')?.sourceBinding;
  assert.ok(corruptedBinding?.kind==='catalogued');
  Object.assign(corruptedBinding,{references:[{catalogueId:'missing',role:'material',evidence:'Bad binding'}]});
  const before=await Promise.all(result.outputs.map(output=>readFile(output.path)));
  await assert.rejects(prepareFacilities({provenance:new Map([['mercury',corrupted]])}),/Unknown canonical source/);
  assert.deepEqual(await Promise.all(result.outputs.map(output=>readFile(output.path))),before);
});

test('an undeclared fact citation leaves both published catalogues intact', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-citation-publication-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputs = ['site/prepared-sources.json', 'site/prepared-facilities.json'];
  // Declared metadata, inventoried R2 files and bounded preview inputs suffice; no undeclared downloads.
  const records = new Set((await promisify(execFile)('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { maxBuffer: 16 * 1024 * 1024 })).stdout.split('\0'));
  const declared = new Set(['site/prepared-object-catalog.mts', 'site/prepared-object-distances.json', 'site/prepared-focus-objects.json',
    ...await sourceTestGeneratedPaths(), ...await inventoriedPreparedPaths(), ...await volumeSourceInputs()]);
  assert.deepEqual(prepared.closure.filter(path => !records.has(path) && !declared.has(path)), [],
    'Sources use tracked records plus declared generated, inventoried or volume-source metadata, never undeclared downloads');
  for (const path of [...prepared.closure, ...outputs, ...await volumePreviewInputs()]) {
    const target = join(root, path);
    await mkdir(join(target, '..'), { recursive: true });
    await copyFile(path, target);
  }
  const before = await Promise.all(outputs.map(path => readFile(join(root, path), 'utf8')));
  // Evidence authored here carries no pin; git shows an edit to it. A fact must still cite a file the manifest declares.
  const manifestPath = join(root, 'src/objects/abundantia/source/manifest.json'), manifestText = await readFile(manifestPath, 'utf8');
  const undeclared = sourceObject(JSON.parse(manifestText));
  for (const section of ['inputs', 'documents', 'generatedIntermediates']) undeclared[section] = sourceArray(undeclared[section] ?? [], sourceObject).filter(entry => entry.path !== 'reference/calibration.json');
  await writeFile(manifestPath, JSON.stringify(undeclared, null, 2) + '\n');
  await assert.rejects(prepareFacilities({ root, provenance }), /fact evidence needs one manifest entry/);
  assert.deepEqual(await Promise.all(outputs.map(path => readFile(join(root, path), 'utf8'))), before);
  await writeFile(manifestPath, manifestText);
  const rebuilt = await prepareFacilities({ root, provenance });
  const focusDatasets = rebuilt.preparedSources.usage.datasets.filter(dataset => dataset.href.startsWith('/sun/?focus='));
  assert.ok(focusDatasets.length > 0, 'The fixture must exercise delivered volume datasets.');
  assert.deepEqual(focusDatasets, prepared.usage.datasets.filter(dataset => dataset.href.startsWith('/sun/?focus=')),
    'Every published LMC and nebula lens retains its source destination without optional volume assets.');
  assert.deepEqual(focusDatasets, rebuilt.prepared.graph.datasets.filter(dataset => dataset.href.startsWith('/sun/?focus=')));
  for (const id of new Set(focusDatasets.map(dataset => dataset.objectId))) {
    await assert.rejects(readFile(join(root, `src/objects/${id}/prepared/lenses.json`)), { code: 'ENOENT' });
    assert.ok(rebuilt.preparedSources.inventory.some(entry => entry.ownerPath === `src/objects/${id}/source/manifest.json` && entry.used));
  }
});

test('missing cited evidence restores without body assets and leaves catalogues atomic on a bad download', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-citation-restoration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputs = ['site/prepared-sources.json', 'site/prepared-facilities.json'];
  // Dinkinesh's shape fact cites the pinned TEMPEST mesh, the one fact whose evidence is a plain download.
  const source = 'src/objects/dinkinesh/source';
  const paper = `${source}/shape/tempest-dinkinesh.stl`;
  // The cited file is a pinned download, so no checkout tracks it. Restoring
  // it needs the provider, which this suite must not depend on; a checkout
  // without it reports the skip instead of failing on the fixture.
  const bytes = await readFile(paper).catch((error: unknown) => {
    if (hasErrorCode(error, 'ENOENT')) return null;
    throw error;
  });
  if (bytes === null) {
    t.skip(`${paper} is not restored here; run "node tools/assets/restore-source-inputs.mts --object=dinkinesh" to cover this.`);
    return;
  }
  const paths = new Set([...prepared.closure, ...explorationCompilerClosure,
    ...outputs, `${source}/preparation/acquisition.json`, ...await volumePreviewInputs()]);
  paths.delete(paper);
  for (const path of paths) {
    const target = join(root, path);
    await mkdir(join(target, '..'), { recursive: true });
    await copyFile(path, target);
  }
  const before = await Promise.all(outputs.map(path => readFile(join(root, path), 'utf8')));
  const requests: string[] = [];
  const fetchPaper = async (url: string) => {
    requests.push(url);
    assert.equal(url, 'https://raw.githubusercontent.com/duncanLyster/TEMPEST/7df4c88063ebe811cbdd25b97c19f85559607459/data/shape_models/dinkinesh.stl');
    return new Response(bytes);
  };
  const result = await prepareFacilities({ root, provenance, sourceTransport: { fetch: fetchPaper } });
  assert.deepEqual(requests, ['https://raw.githubusercontent.com/duncanLyster/TEMPEST/7df4c88063ebe811cbdd25b97c19f85559607459/data/shape_models/dinkinesh.stl']);
  assert.deepEqual(await readFile(join(root, paper)), bytes);
  assert.ok(result.preparedSources.closure.includes(paper));
  const offline = await prepareFacilities({ root, provenance, sourceTransport: { fetch: async () => { throw new Error('Unexpected citation refresh'); } } });
  assert.deepEqual(offline.outputs, result.outputs, 'warm and cold preparation have identical closures');
});

test('numerical extraction uses current package records and preserves reviewed source bindings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-source-authoring-'));
  try {
    const script = 'tools/objects/source-authoring/distant-worlds/author.py';
    const source = 'src/objects/salacia/source';
    const files = [script, 'src/objects/salacia/object.json', ...[
      'manifest.json','content/object.json','preparation/terrestrial.json','preparation/acquisition.json','material/neutral.png',
    ].map(path => `${source}/${path}`)];
    for (const path of files) {
      const target = join(root,path);
      await mkdir(join(target,'..'),{recursive:true});
      await copyFile(path,target);
    }
    // The extractor does not read this retained common asset or change its pin.
    for (const path of ['presentation/InterVariable.ttf']) {
      const target = join(root,source,path);
      await mkdir(join(target,'..'),{recursive:true}); await writeFile(target,'');
    }
    const inputs = sourceObject(await read('tools/objects/source-authoring/distant-worlds/inputs.json'));
    inputs.bodies = sourceArray(inputs.bodies,sourceObject).filter(body => body.id === 'salacia');
    await writeFile(join(root,'inputs.json'),JSON.stringify(inputs));
    const before = sourceObject(await read(`${source}/manifest.json`));
    await promisify(execFile)('python3',[join(root,script),'inputs.json'],{cwd:root});
    const after = sourceObject(await read(join(root,source,'manifest.json')));
    assert.equal(after.schema,before.schema);
    const previousInputs = sourceArray(before.inputs,sourceObject), nextInputs = sourceArray(after.inputs,sourceObject);
    for (const previous of previousInputs) {
      const next = nextInputs.find(row => row.id === previous.id)!;
      assert.deepEqual(next.sourceBinding,previous.sourceBinding);
    }
    assert.deepEqual(after.documents,before.documents);
    assert.deepEqual(after.generatedIntermediates,before.generatedIntermediates);
    const descriptor = sourceObject(await read(join(root,'src/objects/salacia/object.json')));
    assert.deepEqual(sourceObject(descriptor.properties).catalog,sourceObject(sourceObject(await read('src/objects/salacia/object.json')).properties).catalog);
  } finally { await rm(root,{recursive:true,force:true}); }
});
