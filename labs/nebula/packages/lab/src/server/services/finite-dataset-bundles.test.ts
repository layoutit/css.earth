import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { discoverFiniteDatasetBundle } from './finite-dataset-bundles.ts';
import { readPreparedReconstruction, reconstructionCatalogue } from './density-reconstruction.ts';

const cache = '.local/nebula-lab/reconstructions';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'nebula-finite-datasets-'));
  async function save(path: string, value: unknown, time?: string) {
    const text = JSON.stringify(value), full = join(root, path);
    await mkdir(dirname(full), { recursive: true }); await writeFile(full, text);
    if (time) await utimes(full, new Date(time), new Date(time));
  }
  async function model(id: string, time: string) {
    await save(`${cache}/${id}/result.json`, { schema: 'cssearth-nebula-reconstruction@1', resultId: id }, time);
  }
  /** A saved dataset in the exact shape the finite-dataset bake publishes. */
  async function dataset(id: string, imageId: string, modelResultId: string, subjectId = 'smc-constrained') {
    const directory = `${cache}/${id}`, finiteMaterial = { modelResultId, sourceResultId: 'result-e' };
    await save(`${directory}/source/provenance.json`, { method: 'simulation-guided-finite-material@1', finiteMaterial });
    await save(`${directory}/prepared/volume.json`, { data: { resources: [] } });
    await save(`${directory}/object.json`, { id: `reconstruction-${id}`, type: 'density-volume',
      properties: { preparation: { source: 'source/provenance.json' } }, prepared: { url: 'prepared/volume.json' } });
    await save(`${directory}/result.json`, { schema: 'cssearth-nebula-reconstruction@1', resultId: id, imageId, finiteMaterial,
      subject: { id: `reconstruction-${id}`, directory, sourceSubjectId: subjectId } });
  }
  const bundle = (modelResultId: string, datasets: { imageId: string; resultId: string }[], time: string) =>
    save(`.local/nebula-lab/finite-datasets-${modelResultId}.json`, { schema: 'cssearth-finite-dataset-bundle@1', modelResultId, datasets }, time);
  return { root, save, model, dataset, bundle };
}

test('datasets are discovered from the newest fitted model bundle, never from fixed identities', async () => {
  const { root, model, dataset, bundle } = await fixture();
  const oldModel = 'result-1', newModel = 'result-2';
  try {
    await model(oldModel, '2026-09-01'); await model(newModel, '2026-09-10');
    await dataset('result-a', 'smc-vista', oldModel); await dataset('result-b', 'smc-dss2', oldModel);
    await dataset('result-c', 'smc-smash', newModel);
    // The older model's index was rewritten later; model completion time still selects the re-fit.
    await bundle(newModel, [{ imageId: 'smc-smash', resultId: 'result-c' }], '2026-09-11');
    await bundle(oldModel, [{ imageId: 'smc-vista', resultId: 'result-a' }, { imageId: 'smc-dss2', resultId: 'result-b' }], '2026-09-12');
    const found = await discoverFiniteDatasetBundle(root, 'smc-constrained', readPreparedReconstruction);
    assert.equal(found?.modelResultId, newModel);
    assert.deepEqual(found.datasets.map(item => [item.imageId, item.result.resultId]), [['smc-smash', 'result-c']]);
    assert.equal(found.datasets[0]!.result.subject.materialGeometry, newModel);
    assert.equal(found.bundle, `.local/nebula-lab/finite-datasets-${newModel}.json`);
    assert.equal(await discoverFiniteDatasetBundle(root, 'lmc-clouds', readPreparedReconstruction), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a bundle whose dataset belongs to another model or lacks its model result is not selectable', async () => {
  const { root, model, dataset, bundle } = await fixture();
  const oldModel = 'result-3', newModel = 'result-4', unpublished = 'result-5';
  try {
    await model(oldModel, '2026-09-01'); await model(newModel, '2026-09-10');
    await dataset('result-a', 'smc-vista', oldModel);
    await bundle(oldModel, [{ imageId: 'smc-vista', resultId: 'result-a' }], '2026-09-02');
    await bundle(newModel, [{ imageId: 'smc-vista', resultId: 'result-a' }], '2026-09-11');
    await bundle(unpublished, [{ imageId: 'smc-vista', resultId: 'result-a' }], '2026-09-12');
    const found = await discoverFiniteDatasetBundle(root, 'smc-constrained', readPreparedReconstruction);
    assert.equal(found?.modelResultId, oldModel);
    assert.deepEqual(found.datasets.map(item => item.imageId), ['smc-vista']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a saved dataset cannot claim a shared model its pinned provenance does not name', async () => {
  const { root, save, dataset } = await fixture();
  const id = 'result-6';
  try {
    await dataset(id, 'smc-vista', 'result-7');
    const path = `${cache}/${id}/result.json`, result = { schema: 'cssearth-nebula-reconstruction@1', resultId: id, imageId: 'smc-vista',
      finiteMaterial: { modelResultId: 'result-8', sourceResultId: 'result-e' }, subject: { id: `reconstruction-${id}`, directory: `${cache}/${id}` } };
    await save(path, result);
    await assert.rejects(readPreparedReconstruction(root, id), /finite material differs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the catalogue keeps every candidate, marks images without a dataset unavailable and reports rejected newer models', async () => {
  const { root, save, model, dataset, bundle } = await fixture();
  const current = 'result-9', broken = 'result-0', overlay = 'src/objects/smc-volume/source/candidates';
  try {
    await save('labs/nebula/packages/lab/src/state/processing-subjects.json', [{ id: 'smc-constrained', density: { overlays: `${overlay}/overlays.json`, processingPlan: 'plan.json' } }]);
    await save('catalogue.json', { targets: [{ directory: overlay, images: ['smc-vista', 'smc-wise'].map(id => ({ id, label: id })) }] });
    await save('alignment.json', { pass: false });
    await save('plan.json', { catalogue: 'catalogue.json', alignmentReport: { path: 'alignment.json' } });
    await save(`${overlay}/overlays.json`, { overlays: ['smc-vista', 'smc-wise'].map(id => ({ id, style: { transform: '' } })) });
    await model(current, '2026-09-01'); await model(broken, '2026-09-10');
    await dataset('result-a', 'smc-vista', current);
    await bundle(current, [{ imageId: 'smc-vista', resultId: 'result-a' }], '2026-09-02');
    await bundle(broken, [{ imageId: 'smc-vista', resultId: 'result-b' }], '2026-09-11');
    const value = await reconstructionCatalogue(root, 'smc-constrained');
    assert.equal(value.finiteModel?.modelResultId, current);
    assert.deepEqual(value.finiteModel.skipped?.map(item => item.modelResultId), [broken]);
    assert.deepEqual(value.candidates.map(row => [row.imageId, row.prepared?.resultId, Boolean(row.unavailable)]),
      [['smc-vista', 'result-a', false], ['smc-wise', undefined, true]]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('one prepared star layer of a model is referenced by every dataset, and unexpected or foreign stars reject the bundle', async () => {
  const { root, save, model, dataset, bundle } = await fixture();
  const current = 'result-d', other = 'result-c';
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 1.9e21], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 3.085677581491367e19,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const star = { id: 'Bonanos2010:AzV1', raDeg: 10, decDeg: -72, magnitude: 12, colorIndexBv: null, spectralType: 'B0', positionUnits: [0, 0, 0],
    sizePx: 2, colorCss: '#ffffff', opacity: 1, cloudSignal: .5, cloudPartIds: ['all-light'] };
  const payload = (modelResultId: string) => ({ schema: 'cssearth-catalogue-stars@2', id: 'smc-stars', starIdPrefix: 'Bonanos2010:', frame, magnitudeBand: 'V',
    stars: [star], sourceUrl: 'https://example.org', credit: 'test', depthAssumption: 'test', provenance: { finiteModel: { modelResultId } } });
  const index = (subjectId = 'smc-constrained') => save(`.local/nebula-lab/finite-stars-${current}.json`,
    { schema: 'cssearth-finite-model-stars@1', modelResultId: current, subjectId, stars: { path: 'stars.json' } });
  try {
    await model(current, '2026-09-01');
    await save(`${cache}/${current}/source/provenance.json`, { request: { frame } });
    await dataset('result-a', 'smc-vista', current); await dataset('result-b', 'smc-dss2', current);
    await bundle(current, [{ imageId: 'smc-vista', resultId: 'result-a' }, { imageId: 'smc-dss2', resultId: 'result-b' }], '2026-09-02');
    const discover = () => discoverFiniteDatasetBundle(root, 'smc-constrained', readPreparedReconstruction);
    assert.deepEqual((await discover())?.datasets.map(item => item.result.subject.stars), [undefined, undefined], 'No index means no stars, not an error.');
    await save('stars.json', payload(current)); await index();
    assert.deepEqual((await discover())?.datasets.map(item => item.result.subject.stars), ['stars.json', 'stars.json']);
    await save(`.local/nebula-lab/finite-stars-${current}.json`, { schema: 'cssearth-finite-model-stars@1', modelResultId: current,
      subjectId: 'smc-constrained', stars: { path: 'stars.json', bytes: 1 } });
    let found = await discover();
    assert.equal(found, null, 'A star index names its stars by path only.');
    await save('stars.json', payload(other)); await index();
    assert.equal(await discover(), null, 'Stars realized in another model must not attach.');
    await save('stars.json', { ...payload(current), frame: { ...frame, metersPerUnit: frame.metersPerUnit * 3 } }); await index();
    assert.equal(await discover(), null, 'Stars in a different physical frame must not attach.');
    await save('stars.json', payload(current)); await index('lmc-clouds');
    found = await discover();
    assert.equal(found, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
