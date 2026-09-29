import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPublishedCompiler, readPublishedCompiler } from './compiler-published';
import type { CompilerResult } from './result.ts';
import { readCompilerRequest } from './model.ts';

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
  inputs: [...files.keys()].map(path => ({ path })),
  result: { path: '.local/nebula-lab/compiler/example/result.json' } };
const pointer = '.local/nebula-lab/compiler-published/example.json';

test('published compiler receipt requires a unique complete configured input set named by path', async () => {
  assert.equal(readPublishedCompiler(publication, recipePath).inputs.length, 5);
  assert.throws(() => readPublishedCompiler(publication, 'labs/nebula/models/other/compiler.json'), /publication/);
  assert.throws(() => readPublishedCompiler({ ...publication, inputs: [...publication.inputs, publication.inputs[0]] }, recipePath), /ownership/);
  assert.throws(() => readPublishedCompiler({ ...publication, inputs: [{ ...publication.inputs[0], bytes: 2 }, ...publication.inputs.slice(1)] }, recipePath), /compiler input/);
  const missing = { ...publication, inputs: publication.inputs.map(item => item.path === recipe.structureRecipe ? { ...item, path: 'labs/nebula/models/example/unrelated.json' } : item) };
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, async path => new Response(path === pointer ? JSON.stringify(missing) : files.get(path) ?? '{}')), /every configured source/);
});

test('absent CLI publication is an empty workspace, not an implicit processing request', async () => {
  let reads = 0;
  assert.equal(await loadPublishedCompiler(pointer, recipePath, async () => { reads++; return new Response(null, { status: 404 }); }), null);
  assert.equal(reads, 1);
});

test('a saved cloud stays inspectable while its method names the current recipe', async () => {
  const fixture = completedFixture(), methodPath = fixture.result.method.path;
  assert.equal((await loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal))?.id, fixture.result.id);
  fixture.data.set(methodPath, '{}');
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal), /does not match its current recipe/);
});

/** Minimal valid metadata receipt; texture decoding belongs to the volume runtime tests. */
function completedFixture(options: { depth?: boolean; photometric?: boolean; depthId?: string; ledgerId?: string; omitMethodDepth?: boolean } = {}) {
  const data = new Map(files), id = 'example', directory = `.local/nebula-lab/compiler/${id}`;
  const depthPath = 'labs/nebula/models/example/depth.json', evidencePath = 'labs/nebula/models/example/evidence.json';
  const compiler = { ...recipe, ...(options.depth ? { depthRecipe: depthPath } : {}), ...(options.photometric ? { photometricPriorRecipe: depthPath } : {}) };
  data.set(recipePath, JSON.stringify(compiler));
  const inputPaths = [...data.keys()];
  const put = (path: string, value: unknown) => { data.set(path, JSON.stringify(value)); return { path }; };
  let physicalDepth: { recipe: { path: string }; evidence: { path: string } } | undefined;
  if (options.depth || options.photometric) {
    const ledger = { schema: 'cssearth-nebula-physical-evidence@1', subjectId: options.ledgerId ?? recipe.id, sources: [], evidence: [], methods: [] };
    const evidence = put(evidencePath, ledger);
    const depth = { schema: options.photometric ? 'cssearth-photometric-mge@1' : 'cssearth-nebula-depth-model@1', id: options.depthId ?? recipe.id, evidence };
    put(depthPath, depth); inputPaths.push(depthPath, evidencePath);
    physicalDepth = { recipe: put(`${directory}/depth.json`, depth), evidence: put(`${directory}/evidence.json`, ledger) };
  }
  const controls = { detail: .65, faint: .35, depth: 1 };
  const method = put(`${directory}/method.json`, { recipePath,
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
      stars: [], sampling: { sliceCounts: { x: 1, y: 1, z: 1 }, imageWidth: 512, samplesPerSlab: 4 } } };
  const receipt = { ...publication, inputs: inputPaths.map(path => ({ path })), result: put(`${directory}/result.json`, result) };
  const fetchLocal = async (path: string) => path === pointer ? Response.json(receipt) : data.has(path) ? new Response(data.get(path)!) : new Response(null, { status: 404 });
  return { data, receipt, fetchLocal, depthPath, evidencePath, result };
}

test('image-only and depth-guided publications both restore without processing', async () => {
  for (const depth of [false, true]) {
    const fixture = completedFixture({ depth });
    assert.equal((await loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal))?.id, fixture.result.id);
  }
});

test('photometric publication requires the configured model and evidence used for the saved volume', async () => {
  const good = completedFixture({ photometric: true });
  assert.equal((await loadPublishedCompiler(pointer, recipePath, good.fetchLocal))?.id, good.result.id);
  for (const target of ['depthPath', 'evidencePath'] as const) {
    const missing = completedFixture({ photometric: true });
    missing.receipt.inputs = missing.receipt.inputs.filter(input => input.path !== missing[target]);
    await assert.rejects(loadPublishedCompiler(pointer, recipePath, missing.fetchLocal), /configured source|configured evidence/);
  }
  for (const options of [{ omitMethodDepth: true }, { depthId: 'other' }]) {
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
    fixture.receipt.inputs = fixture.receipt.inputs.filter(input => input.path !== fixture[target]);
    await assert.rejects(loadPublishedCompiler(pointer, recipePath, fixture.fetchLocal), target === 'depthPath' ? /every configured source/ : /declared depth evidence/);
  }
});

test('depth and evidence inputs cannot change object identity', async () => {
  const wrongDepth = completedFixture({ depth: true, depthId: 'another-object' });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, wrongDepth.fetchLocal), /depth recipe belongs to another/);
  const wrongLedger = completedFixture({ depth: true, ledgerId: 'another-object' });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, wrongLedger.fetchLocal), /evidence ledger belongs to another/);
});

test('a publication cannot relabel a bake whose method omits its depth snapshots', async () => {
  const absent = completedFixture({ depth: true, omitMethodDepth: true });
  await assert.rejects(loadPublishedCompiler(pointer, recipePath, absent.fetchLocal), /omits the configured depth/);
});
