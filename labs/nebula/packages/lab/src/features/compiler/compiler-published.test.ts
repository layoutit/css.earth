import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { loadPublishedCompiler, readPublishedCompiler } from './compiler-published';
import type { CompilerResult } from './result.ts';
import { readCompilerRequest } from './model.ts';
import { implementationPins } from '../../server/services/implementation.ts';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const recipePath = 'labs/nebula/models/example/compiler.json';
const recipe = { schema: 'cssearth-nebula-compiler@1', id: 'example', label: 'Example',
  observationRecipe: 'labs/nebula/models/example/observations.json',
  observationCatalogue: '.local/nebula-lab/observations/example/observations.json',
  structureRecipe: 'labs/nebula/models/example/observation-structures.json',
  structureCatalogue: '.local/nebula-lab/observations/example/structures/catalogue.json',
  defaultSourceId: 'optical', maximumStars: 100, interpretation: 'Image-only depth.' };
const files = new Map([[recipePath, JSON.stringify(recipe)], ...[recipe.observationRecipe, recipe.observationCatalogue,
  recipe.structureRecipe, recipe.structureCatalogue].map(path => [path, '{}'] as [string, string])]);
const publication = { schema: 'cssearth-nebula-compiler-published@1', recipePath,
  inputs: [...files].map(([path, bytes]) => ({ path, sha256: digest(bytes) })),
  result: { path: `.local/nebula-lab/compiler/${'1'.repeat(64)}/result.json`, sha256: digest('{}') } };
const pointer = '.local/nebula-lab/compiler-published/example.json';

test('published compiler receipt requires a unique complete configured input set', async () => {
  assert.equal(readPublishedCompiler(publication, recipePath).inputs.length, 5);
  assert.throws(() => readPublishedCompiler(publication, 'labs/nebula/models/other/compiler.json'), /publication/);
  assert.throws(() => readPublishedCompiler({ ...publication, inputs: [...publication.inputs, publication.inputs[0]] }, recipePath), /ownership/);
  const missing = { ...publication, inputs: publication.inputs.map(item => item.path === recipe.structureRecipe ? { ...item, path: 'labs/nebula/models/example/unrelated.json' } : item) };
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, async path => new Response(path === pointer ? JSON.stringify(missing) : files.get(path) ?? '{}')), /every configured source/);
});

test('changed current input bytes prevent displaying the old cloud', async () => {
  let resultFetched = false;
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, async path => {
    if (path === pointer) return Response.json(publication);
    if (path === publication.result.path) resultFetched = true;
    return new Response(path === recipe.observationCatalogue ? '{"changed":true}' : files.get(path) ?? '{}');
  }), /sources changed/);
  assert.equal(resultFetched, false);
});

test('absent CLI publication is an empty workspace, not an implicit processing request', async () => {
  let reads = 0;
  assert.equal(await loadPublishedCompiler(pointer, recipePath, async () => { reads++; return new Response(null, { status: 404 }); }), null);
  assert.equal(reads, 1);
});

test('saved clouds remain inspectable after producer code changes without rewriting its historical hash', async () => {
  const fixture = completedFixture(), owner = 'labs/nebula/src/reconstruction/compiler/old-producer.ts';
  const methodPath = fixture.result.method.path, method = JSON.parse(fixture.data.get(methodPath)!);
  const historicalHash = digest('original producer');
  method.implementation = [{ name: 'old-producer.ts', sha256: historicalHash }];
  fixture.data.set(methodPath, JSON.stringify(method));
  fixture.result.method.sha256 = digest(fixture.data.get(methodPath)!);
  fixture.data.set(fixture.receipt.result.path, JSON.stringify(fixture.result));
  fixture.receipt.result.sha256 = digest(fixture.data.get(fixture.receipt.result.path)!);
  fixture.receipt.inputs.push({ path: owner, sha256: historicalHash });
  fixture.data.set(owner, 'changed producer');
  assert.equal((await loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal))?.id, fixture.result.id);
  assert.equal(fixture.receipt.inputs.at(-1)!.sha256, historicalHash);
  fixture.data.set(methodPath, '{}');
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal), /sources changed/);
});

/** Minimal valid metadata receipt; texture decoding belongs to the volume runtime tests. */
function completedFixture(options: { depth?: boolean; photometric?: boolean; depthId?: string; ledgerId?: string; declaredEvidenceHash?: string; omitMethodDepth?: boolean; staleSnapshot?: boolean } = {}) {
  const data = new Map(files), id = '1'.repeat(64), directory = `.local/nebula-lab/compiler/${id}`;
  const depthPath = 'labs/nebula/models/example/depth.json', evidencePath = 'labs/nebula/models/example/evidence.json';
  const compiler = { ...recipe, ...(options.depth ? { depthRecipe: depthPath } : {}), ...(options.photometric ? { photometricPriorRecipe: depthPath } : {}) };
  data.set(recipePath, JSON.stringify(compiler));
  const inputPaths = [...data.keys()];
  const put = (path: string, value: unknown) => { const bytes = JSON.stringify(value); data.set(path, bytes); return { path, sha256: digest(bytes) }; };
  let physicalDepth: { recipe: { path: string; sha256: string }; evidence: { path: string; sha256: string } } | undefined;
  if (options.depth || options.photometric) {
    const ledger = { schema: 'cssearth-nebula-physical-evidence@1', subjectId: options.ledgerId ?? recipe.id, sources: [], evidence: [], methods: [] };
    const evidence = put(evidencePath, ledger);
    const depth = { schema: options.photometric ? 'cssearth-photometric-mge@1' : 'cssearth-nebula-depth-model@1', id: options.depthId ?? recipe.id,
      evidence: { ...evidence, sha256: options.declaredEvidenceHash ?? evidence.sha256 } };
    put(depthPath, depth); inputPaths.push(depthPath, evidencePath);
    physicalDepth = { recipe: put(`${directory}/depth.json`, options.staleSnapshot ? { ...depth, historical: true } : depth),
      evidence: put(`${directory}/evidence.json`, ledger) };
  }
  const controls = { detail: .65, faint: .35, depth: 1 };
  const method = put(`${directory}/method.json`, { recipeSha256: digest(data.get(recipePath)!), implementation: [],
    request: { action: 'apply', imageId: 'compiler', recipePath, cataloguePath: recipe.structureCatalogue,
      imageToFrame: {}, evidence: { sensitivity: 1, weights: [] }, controls },
    ...(!options.omitMethodDepth && physicalDepth ? options.photometric ? { photometricPrior: physicalDepth } : { physicalDepth } : {}) });
  const blob = put(`${directory}/placeholder.json`, {}), bounds = { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
  const sky = { min: [-1, -1] as [number, number], max: [1, 1] as [number, number] };
  const result: CompilerResult = { schema: 'cssearth-nebula-compiler-result@1', id, label: 'Example', defaultSourceId: 'optical', controls, pipeline: [],
    metrics: { components: 1, unconstrainedComponents: 1, stars: 0, fitRmse: 0, baselineRmse: 1, missingSignalFraction: 0, excessSignalFraction: 0 },
    sources: [{ id: 'optical', label: 'Optical', credit: 'Test source', page: 'https://example.com/image', original: blob, starless: blob, width: 512, height: 512, boundsArcsec: sky }],
    model: blob, method, target: blob, projection: blob, residual: blob, interpretation: 'Conditional display emission.',
    scene: { schema: 'cssearth-compiler-bake@1', id, fieldIdentity: id, boundsArcsec: bounds, skyBoundsArcsec: sky, spanArcsec: 2,
      frame: { referenceFrame: 'lab-sky-angular', epochJdTt: 2451545, metersPerUnit: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], boundsUnits: bounds },
      sourceImage: { width: 512, height: 512 }, coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: [0, 0, 0], earthView: 'observer-at-negative-z-looking-away' },
      neutral: blob, lenses: [{ id: 'optical', label: 'Optical', volume: blob, coverage: { positiveAlphaTexels: 1, recoloredTexels: 1, outsideImageTexels: 0 } }],
      stars: [], alphaSha256: id, sampling: { sliceCounts: { x: 1, y: 1, z: 1 }, imageWidth: 512, samplesPerSlab: 4 } } };
  const receipt = { ...publication, inputs: inputPaths.map(path => ({ path, sha256: digest(data.get(path)!) })), result: put(`${directory}/result.json`, result) };
  const fetchLocal = async (path: string) => path === pointer ? Response.json(receipt) : data.has(path) ? new Response(data.get(path)!) : new Response(null, { status: 404 });
  return { data, receipt, fetchLocal, depthPath, evidencePath, result };
}

test('legacy and fully pinned depth receipts both restore without processing', async () => {
  for (const depth of [false, true]) {
    const fixture = completedFixture({ depth });
    assert.equal((await loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal))?.id, fixture.result.id);
  }
});

test('photometric publication requires the exact model and evidence used for the saved volume', async () => {
  const good = completedFixture({ photometric: true });
  assert.equal((await loadPublishedCompiler(pointer, recipePath, good.fetchLocal))?.id, good.result.id);
  for (const target of ['depthPath', 'evidencePath'] as const) {
    const missing = completedFixture({ photometric: true });
    missing.receipt.inputs = missing.receipt.inputs.filter(pin => pin.path !== missing[target]);
    await assert.rejects(loadPublishedCompiler(pointer, recipePath, missing.fetchLocal), /configured source|configured evidence/);
  }
  for (const options of [{ omitMethodDepth: true }, { depthId: 'other' }, { staleSnapshot: true }]) {
    const bad = completedFixture({ photometric: true, ...options });
    await assert.rejects(loadPublishedCompiler(pointer, recipePath, bad.fetchLocal), /configured photometric model|configured evidence/);
  }
});

test('a current publication can replace a saved result only for the same controls, evidence and registration', async () => {
  const fixture = completedFixture();
  const expected = readCompilerRequest({ action: 'apply', imageId: 'compiler', recipePath, cataloguePath: recipe.structureCatalogue,
    controls: fixture.result.controls, evidence: { sensitivity: 1, weights: [] }, imageToFrame: {} });
  assert.equal((await loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal, expected))?.id, fixture.result.id);
  for (const changed of [{ ...expected, controls: { ...expected.controls, faint: .8 } },
    { ...expected, evidence: { sensitivity: 2, weights: [] } }, { ...expected, evidence: { sensitivity: 1, weights: [.5] } },
    { ...expected, imageToFrame: { optical: [1, 0, 0, 1, 30, 40] } }])
    assert.equal(await loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal, readCompilerRequest(changed)), null);
});

test('publication cannot omit its configured depth recipe or declared evidence ledger', async () => {
  for (const target of ['depthPath', 'evidencePath'] as const) {
    const fixture = completedFixture({ depth: true });
    fixture.receipt.inputs = fixture.receipt.inputs.filter(pin => pin.path !== fixture[target]);
    await assert.rejects(loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal), target === 'depthPath' ? /every configured source/ : /declared depth evidence/);
  }
});

test('depth and evidence inputs cannot drift or change object identity', async () => {
  for (const target of ['depthPath', 'evidencePath'] as const) {
    const fixture = completedFixture({ depth: true }); fixture.data.set(fixture[target], '{"changed":true}');
    await assert.rejects(loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal), /sources changed/);
  }
  const wrongDepth = completedFixture({ depth: true, depthId: 'another-object' });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, wrongDepth.fetchLocal), /depth recipe belongs to another/);
  const wrongLedger = completedFixture({ depth: true, ledgerId: 'another-object' });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, wrongLedger.fetchLocal), /evidence ledger belongs to another/);
  const wrongHash = completedFixture({ depth: true, declaredEvidenceHash: '2'.repeat(64) });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, wrongHash.fetchLocal), /declared depth evidence/);
});

test('current depth pins cannot relabel a historical bake with missing or different depth snapshots', async () => {
  const absent = completedFixture({ depth: true, omitMethodDepth: true });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, absent.fetchLocal), /omits the configured depth/);
  const historical = completedFixture({ depth: true, staleSnapshot: true });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, historical.fetchLocal), /different depth sources/);
  const changed = completedFixture({ depth: true });
  changed.data.set(`.local/nebula-lab/compiler/${changed.result.id}/evidence.json`, '{"changed":true}');
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, changed.fetchLocal), /sources changed/);
});


test('relocated producer closures restore without fetching current code or changing historical hashes', async () => {
  const owners = await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/server/workflows/compiler/compile.ts']);
  assert.ok(owners.some(owner => owner.path.startsWith('src/preparation/')));
  assert.ok(owners.some(owner => owner.path.endsWith('/package.json')));
  const fixture = completedFixture(), historicalOwners = owners.map(owner => ({ ...owner, sha256: digest(`historical ${owner.path}`) }));
  const method = JSON.parse(fixture.data.get(fixture.result.method.path)!);
  method.implementation = historicalOwners;
  const saveMethod = () => {
    fixture.data.set(fixture.result.method.path, JSON.stringify(method));
    fixture.result.method.sha256 = digest(fixture.data.get(fixture.result.method.path)!);
    fixture.data.set(fixture.receipt.result.path, JSON.stringify(fixture.result));
    fixture.receipt.result.sha256 = digest(fixture.data.get(fixture.receipt.result.path)!);
  };
  saveMethod(); fixture.receipt.inputs.push(...historicalOwners);
  const before = JSON.stringify(fixture.receipt), requested: string[] = [];
  const fetchLocal = async (path: string) => {
    requested.push(path);
    assert.equal(owners.some(owner => owner.path === path), false, `Historical producer must not be fetched: ${path}`);
    return fixture.fetchLocal(path);
  };
  assert.equal((await loadPublishedCompiler(pointer, recipePath, fetchLocal))?.id, fixture.result.id);
  assert.equal(JSON.stringify(fixture.receipt), before);
  assert.ok(requested.includes(recipe.observationCatalogue), 'scientific input remains hash checked');
  fixture.data.set(recipe.observationCatalogue, '{"changed":true}');
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, fetchLocal), /sources changed/);
  fixture.data.set(recipe.observationCatalogue, files.get(recipe.observationCatalogue)!);
  fixture.receipt.inputs = fixture.receipt.inputs.filter(owner => owner.path !== historicalOwners[0]!.path);
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, fetchLocal), /implementation/);
  fixture.receipt.inputs.push({ ...historicalOwners[0]!, sha256: digest('mismatched producer') });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, fetchLocal), /implementation/);
  method.implementation = [{ path: recipePath, sha256: fixture.receipt.inputs[0]!.sha256 }]; saveMethod();
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, fetchLocal), /implementation/);
});
