import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { discoverFiniteLensBundle } from './finite-lens-bundles.ts';
import { readPreparedReconstruction, reconstructionCatalogue } from './density-reconstruction.ts';

const cache = '.local/nebula-lab/reconstructions';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'nebula-finite-lenses-'));
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  async function save(path: string, value: unknown, time?: string) {
    const text = JSON.stringify(value), full = join(root, path);
    await mkdir(dirname(full), { recursive: true }); await writeFile(full, text);
    if (time) await utimes(full, new Date(time), new Date(time));
    return hash(text);
  }
  async function model(id: string, time: string) {
    await save(`${cache}/${id}/result.json`, { schema: 'cssearth-nebula-reconstruction@1', resultId: id }, time);
  }
  /** A saved lens in the exact shape the finite-lens bake publishes. */
  async function lens(id: string, imageId: string, modelResultId: string, subjectId = 'smc-constrained') {
    const directory = `${cache}/${id}`, finiteMaterial = { modelResultId, sourceResultId: 'e'.repeat(64) };
    const provenance = await save(`${directory}/source/provenance.json`, { method: 'simulation-guided-finite-material@1', finiteMaterial });
    const volume = await save(`${directory}/prepared/volume.json`, { data: { resources: [] } });
    await save(`${directory}/object.json`, { id: `reconstruction-${id}`, type: 'density-volume',
      properties: { preparation: { source: 'source/provenance.json', sha256: provenance } }, prepared: { url: 'prepared/volume.json', sha256: volume } });
    await save(`${directory}/result.json`, { schema: 'cssearth-nebula-reconstruction@1', resultId: id, imageId, finiteMaterial,
      subject: { id: `reconstruction-${id}`, directory, sourceSubjectId: subjectId } });
  }
  const bundle = (modelResultId: string, lenses: { imageId: string; resultId: string }[], time: string) =>
    save(`.local/nebula-lab/finite-lenses-${modelResultId}.json`, { schema: 'cssearth-finite-lens-bundle@1', modelResultId, lenses }, time);
  return { root, save, model, lens, bundle };
}

test('lenses are discovered from the newest fitted model bundle, never from fixed identities', async () => {
  const { root, model, lens, bundle } = await fixture();
  const oldModel = '1'.repeat(64), newModel = '2'.repeat(64);
  try {
    await model(oldModel, '2026-09-01'); await model(newModel, '2026-09-10');
    await lens('a'.repeat(64), 'smc-vista', oldModel); await lens('b'.repeat(64), 'smc-dss2', oldModel);
    await lens('c'.repeat(64), 'smc-smash', newModel);
    // The older model's index was rewritten later; model completion time still selects the re-fit.
    await bundle(newModel, [{ imageId: 'smc-smash', resultId: 'c'.repeat(64) }], '2026-09-11');
    await bundle(oldModel, [{ imageId: 'smc-vista', resultId: 'a'.repeat(64) }, { imageId: 'smc-dss2', resultId: 'b'.repeat(64) }], '2026-09-12');
    const found = await discoverFiniteLensBundle(root, 'smc-constrained', readPreparedReconstruction);
    assert.equal(found?.modelResultId, newModel);
    assert.deepEqual(found.lenses.map(item => [item.imageId, item.result.resultId]), [['smc-smash', 'c'.repeat(64)]]);
    assert.equal(found.lenses[0]!.result.subject.materialGeometry, newModel);
    assert.equal(found.bundle, `.local/nebula-lab/finite-lenses-${newModel}.json`);
    assert.equal(await discoverFiniteLensBundle(root, 'lmc-clouds', readPreparedReconstruction), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a bundle whose lens belongs to another model or lacks its model result is not selectable', async () => {
  const { root, model, lens, bundle } = await fixture();
  const oldModel = '3'.repeat(64), newModel = '4'.repeat(64), unpublished = '5'.repeat(64);
  try {
    await model(oldModel, '2026-09-01'); await model(newModel, '2026-09-10');
    await lens('a'.repeat(64), 'smc-vista', oldModel);
    await bundle(oldModel, [{ imageId: 'smc-vista', resultId: 'a'.repeat(64) }], '2026-09-02');
    await bundle(newModel, [{ imageId: 'smc-vista', resultId: 'a'.repeat(64) }], '2026-09-11');
    await bundle(unpublished, [{ imageId: 'smc-vista', resultId: 'a'.repeat(64) }], '2026-09-12');
    const found = await discoverFiniteLensBundle(root, 'smc-constrained', readPreparedReconstruction);
    assert.equal(found?.modelResultId, oldModel);
    assert.deepEqual(found.lenses.map(item => item.imageId), ['smc-vista']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a saved lens cannot claim a shared model its pinned provenance does not name', async () => {
  const { root, save, lens } = await fixture();
  const id = '6'.repeat(64);
  try {
    await lens(id, 'smc-vista', '7'.repeat(64));
    const path = `${cache}/${id}/result.json`, result = { schema: 'cssearth-nebula-reconstruction@1', resultId: id, imageId: 'smc-vista',
      finiteMaterial: { modelResultId: '8'.repeat(64), sourceResultId: 'e'.repeat(64) }, subject: { id: `reconstruction-${id}`, directory: `${cache}/${id}` } };
    await save(path, result);
    await assert.rejects(readPreparedReconstruction(root, id), /finite material differs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the catalogue keeps every candidate, marks images without a lens unavailable and reports rejected newer models', async () => {
  const { root, save, model, lens, bundle } = await fixture();
  const current = '9'.repeat(64), broken = '0'.repeat(64), overlay = 'labs/nebula/models/smc/candidates';
  try {
    await save('labs/nebula/packages/lab/src/state/subjects.json', [{ id: 'smc-constrained', density: { overlays: `${overlay}/overlays.json`, processingPlan: 'plan.json' } }]);
    await save('catalogue.json', { targets: [{ directory: overlay, images: ['smc-vista', 'smc-wise'].map(id => ({ id, label: id, sha256: 'f'.repeat(64) })) }] });
    const alignment = await save('alignment.json', { pass: false });
    await save('plan.json', { catalogue: 'catalogue.json', alignmentReport: { path: 'alignment.json', sha256: alignment } });
    await save(`${overlay}/overlays.json`, { overlays: ['smc-vista', 'smc-wise'].map(id => ({ id, style: { transform: '' } })) });
    await model(current, '2026-09-01'); await model(broken, '2026-09-10');
    await lens('a'.repeat(64), 'smc-vista', current);
    await bundle(current, [{ imageId: 'smc-vista', resultId: 'a'.repeat(64) }], '2026-09-02');
    await bundle(broken, [{ imageId: 'smc-vista', resultId: 'b'.repeat(64) }], '2026-09-11');
    const value = await reconstructionCatalogue(root, 'smc-constrained');
    assert.equal(value.finiteModel?.modelResultId, current);
    assert.deepEqual(value.finiteModel.skipped?.map(item => item.modelResultId), [broken]);
    assert.deepEqual(value.candidates.map(row => [row.imageId, row.prepared?.resultId, Boolean(row.unavailable)]),
      [['smc-vista', 'a'.repeat(64), false], ['smc-wise', undefined, true]]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('one prepared star layer of a model is referenced by every lens, and stale or foreign stars reject the bundle', async () => {
  const { root, save, model, lens, bundle } = await fixture();
  const current = 'd'.repeat(64), other = 'c'.repeat(64);
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 1.9e21], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 3.085677581491367e19,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const star = { id: 'Bonanos2010:AzV1', raDeg: 10, decDeg: -72, magnitude: 12, colorIndexBv: null, spectralType: 'B0', positionUnits: [0, 0, 0],
    sizePx: 2, colorCss: '#ffffff', opacity: 1, cloudSignal: .5, cloudPartIds: ['all-light'] };
  const payload = (modelResultId: string) => ({ schema: 'cssearth-catalogue-stars@1', id: 'smc-stars', starIdPrefix: 'Bonanos2010:', frame, magnitudeBand: 'V',
    stars: [star], sourceUrl: 'https://example.org', credit: 'test', depthAssumption: 'test', provenance: { finiteModel: { modelResultId } } });
  const index = (sha256: string, subjectId = 'smc-constrained') => save(`.local/nebula-lab/finite-stars-${current}.json`,
    { schema: 'cssearth-finite-model-stars@1', modelResultId: current, subjectId, stars: { path: 'stars.json', sha256 } });
  try {
    await model(current, '2026-09-01');
    await save(`${cache}/${current}/source/provenance.json`, { request: { frame } });
    await lens('a'.repeat(64), 'smc-vista', current); await lens('b'.repeat(64), 'smc-dss2', current);
    await bundle(current, [{ imageId: 'smc-vista', resultId: 'a'.repeat(64) }, { imageId: 'smc-dss2', resultId: 'b'.repeat(64) }], '2026-09-02');
    const discover = () => discoverFiniteLensBundle(root, 'smc-constrained', readPreparedReconstruction);
    assert.deepEqual((await discover())?.lenses.map(item => item.result.subject.stars), [undefined, undefined], 'No index means no stars, not an error.');
    await index(await save('stars.json', payload(current)));
    assert.deepEqual((await discover())?.lenses.map(item => item.result.subject.stars), ['stars.json', 'stars.json']);
    await save('stars.json', payload(current)); await index('0'.repeat(64));
    let found = await discover();
    assert.equal(found, null, 'A stale star pin must not attach unverified stars.');
    await index(await save('stars.json', payload(other)));
    assert.equal(await discover(), null, 'Stars realized in another model must not attach.');
    await index(await save('stars.json', { ...payload(current), frame: { ...frame, metersPerUnit: frame.metersPerUnit * 3 } }));
    assert.equal(await discover(), null, 'Stars in a different physical frame must not attach.');
    await index(await save('stars.json', payload(current)), 'lmc-clouds');
    found = await discover();
    assert.equal(found, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
