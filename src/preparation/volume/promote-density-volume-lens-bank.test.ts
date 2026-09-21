import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { sha256 } from '../../platform/sha256.mts';
import { loadPreparedVolumeLenses } from '../../renderers/css/volume/prepared-volume-lenses.js';
import { promoteDensityVolumeLensBank } from './promote-density-volume-lens-bank.ts';

const frame = { referenceFrame: 'fixture-icrf', epochJdTt: 2461286.5, originM: [11, 22, 33], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 4, boundsUnits: { min: [-7, -3, -1], max: [5, 9, 11] } };
const json = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'density-volume-bank-')), source = resolve(root, 'source'), destination = resolve(root, 'bank');
  const assets = new Map(['x', 'y', 'z'].map(axis => [`slices/${axis}.bin`, Buffer.from(`exact-${axis}`)]));
  const resource = (path: string) => { const bytes = assets.get(path)!; return { path, sha256: sha256(bytes), bytes: bytes.length, width: 1, height: 1 }; };
  const leaf = (axis: string) => ({ id: `${axis}-0`, centerUnits: [0, 0, 0], texturePath: `slices/${axis}.bin`, widthPx: 1, heightPx: 1,
    style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } });
  const volume = { schema: 'cssearth-css-volume@1', id: 'source-grid', frame, anchors: [], stacks: ['x', 'y', 'z'].map(axis => ({ axis, leaves: [leaf(axis)] })),
    resources: [...assets.keys()].map(resource), provenance: { citation: 'source-native-field', sourceCoordinates: 'measured-grid' }, approximation: { transfer: 'source-display' } };
  const prepared = json({ schema: 'cssearth-prepared-object@1', id: 'source-grid', type: 'density-volume', format: 'cssearth-density-volume@1', data: volume });
  const recipe = Buffer.from('{"source":"fixture"}\n');
  const descriptor = json({ schema: 'cssearth-object@1', id: 'source-grid', type: 'density-volume', properties: { volume: frame,
    preparation: { source: 'source/recipe.json', sha256: sha256(recipe) } }, prepared: { format: 'cssearth-density-volume@1', url: 'prepared/volume.json', sha256: sha256(prepared) } });
  await Promise.all([mkdir(resolve(source, 'source'), { recursive: true }), mkdir(resolve(source, 'prepared/slices'), { recursive: true })]);
  await Promise.all([writeFile(resolve(source, 'source/recipe.json'), recipe), writeFile(resolve(source, 'prepared/volume.json'), prepared), writeFile(resolve(source, 'object.json'), descriptor),
    ...[...assets].map(([path, bytes]) => writeFile(resolve(source, 'prepared', path), bytes))]);
  return { root, source, destination, assets, volume };
}

test('promotes an authenticated physical density volume into one exact selectable bank lens', async () => {
  const f = await fixture();
  try {
    const result = await promoteDensityVolumeLensBank({ sourceDirectory: f.source, destinationDirectory: f.destination, id: 'dust-bank', lensId: 'mean',
      label: 'Posterior mean', title: 'Dust density posterior mean', description: 'Native physical-grid density display.', sourceUrl: 'https://example.org/source',
      framingRadiusUnits: 18, attachedTo: 'fixture-body' });
    assert.equal(result.resourceCount, 3);
    const descriptor = JSON.parse(await readFile(result.descriptorPath, 'utf8'));
    const payload = await loadPreparedVolumeLenses(descriptor, { read: path => readFile(resolve(f.destination, path)) });
    assert.equal(payload.attachedTo, 'fixture-body');
    assert.equal(payload.defaultLens, 'mean');
    assert.deepEqual(payload.lenses[0]!.brightness, { overall: 1, x: 1, y: 1, z: 1 });
    assert.deepEqual(payload.lenses[0]!.stars, { frame, points: [] });
    assert.deepEqual(payload.lenses[0]!.volume.frame, frame);
    assert.deepEqual(payload.lenses[0]!.volume.frame.boundsUnits, frame.boundsUnits);
    assert.equal(payload.lenses[0]!.volume.id, 'dust-bank-mean');
    assert.deepEqual(payload.lenses[0]!.volume.provenance, f.volume.provenance);
    assert.deepEqual(payload.lenses[0]!.volume.resources.map(item => item.path), ['mean/slices/x.bin', 'mean/slices/y.bin', 'mean/slices/z.bin']);
    for (const [path, bytes] of f.assets) assert.deepEqual(await readFile(resolve(f.destination, 'prepared/mean', path)), bytes);
    const receipt = JSON.parse(await readFile(result.deliveryPath, 'utf8'));
    assert.equal(receipt.attachedTo, 'fixture-body');
    assert.deepEqual(receipt.source.frame, frame);
    assert.match(receipt.promotion.interpretation, /no depth inference/u);
    assert.deepEqual(payload.provenance, { sourceDensityVolume: f.volume.provenance, measurementFrame: frame, presentationFrame: frame,
      interpretation: 'Promoted prepared physical density volume. No depth was inferred or reconstructed.' });
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('refuses a source resource whose bytes no longer match the density-volume closure', async () => {
  const f = await fixture();
  try {
    await writeFile(resolve(f.source, 'prepared/slices/x.bin'), 'changed');
    await assert.rejects(promoteDensityVolumeLensBank({ sourceDirectory: f.source, destinationDirectory: f.destination, id: 'dust-bank', lensId: 'mean',
      label: 'Posterior mean', title: 'Dust density posterior mean', description: 'Native physical-grid density display.', sourceUrl: 'https://example.org/source', framingRadiusUnits: 18 }),
    /Source density-volume resource pin mismatch: slices\/x\.bin/u);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('re-anchors only the scene presentation while retaining the measurement frame', async () => {
  const f = await fixture();
  const presentationFrame = { ...frame, referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
    originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1] };
  try {
    const result = await promoteDensityVolumeLensBank({ sourceDirectory: f.source, destinationDirectory: f.destination, id: 'corona-bank', lensId: 'density',
      label: 'Electron density', title: 'Coronal electron density', description: 'Measured tomographic grid.', sourceUrl: 'https://example.org/source',
      framingRadiusUnits: 4, attachedTo: 'sun', presentationFrame });
    const descriptor = JSON.parse(await readFile(result.descriptorPath, 'utf8'));
    const payload = await loadPreparedVolumeLenses(descriptor, { read: path => readFile(resolve(f.destination, path)) });
    assert.deepEqual(payload.lenses[0]!.volume.frame, presentationFrame);
    assert.deepEqual(payload.lenses[0]!.stars.frame, presentationFrame);
    assert.deepEqual(payload.provenance.measurementFrame, frame);
    assert.deepEqual(payload.provenance.presentationFrame, presentationFrame);
    const receipt = JSON.parse(await readFile(result.deliveryPath, 'utf8'));
    assert.deepEqual(receipt.source.frame, frame);
    assert.deepEqual(receipt.promotion.presentationFrame, presentationFrame);
    assert.match(receipt.promotion.interpretation, /source measurement frame is retained/u);
    await assert.rejects(promoteDensityVolumeLensBank({ sourceDirectory: f.source, destinationDirectory: resolve(f.root, 'bad'), id: 'bad-bank', lensId: 'density',
      label: 'Electron density', title: 'Coronal electron density', description: 'Measured tomographic grid.', sourceUrl: 'https://example.org/source',
      framingRadiusUnits: 4, presentationFrame: { ...presentationFrame, metersPerUnit: 1 } }), /preserve source scale and bounds/u);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('promotes independently authenticated density grids into selectable namespaced lenses', async () => {
  const first = await fixture(), second = await fixture();
  try {
    const result = await promoteDensityVolumeLensBank({ destinationDirectory: first.destination, id: 'corona-bank', defaultLens: 'regularized',
      framingRadiusUnits: 4, attachedTo: 'sun', presentationFrame: { ...frame, referenceFrame: 'sun-icrf', originM: [0, 0, 0] }, sources: [
        { sourceDirectory: first.source, lensId: 'regularized', label: 'Regularized', title: 'Regularized density', description: 'Published regularized grid.', sourceUrl: 'https://example.org/regularized' },
        { sourceDirectory: second.source, lensId: 'comparison', label: 'Comparison', title: 'Comparison density', description: 'Published comparison grid.', sourceUrl: 'https://example.org/comparison' },
      ] });
    assert.equal(result.resourceCount, 6);
    const descriptor = JSON.parse(await readFile(result.descriptorPath, 'utf8'));
    const payload = await loadPreparedVolumeLenses(descriptor, { read: path => readFile(resolve(first.destination, path)) });
    assert.equal(payload.defaultLens, 'regularized');
    assert.deepEqual(payload.lenses.map(lens => lens.id), ['regularized', 'comparison']);
    assert.deepEqual(payload.lenses.map(lens => lens.volume.resources.map(resource => resource.path)), [
      ['regularized/slices/x.bin', 'regularized/slices/y.bin', 'regularized/slices/z.bin'],
      ['comparison/slices/x.bin', 'comparison/slices/y.bin', 'comparison/slices/z.bin'],
    ]);
    assert.deepEqual(payload.provenance, { sources: [
      { lensId: 'regularized', sourceDensityVolume: first.volume.provenance, measurementFrame: frame },
      { lensId: 'comparison', sourceDensityVolume: second.volume.provenance, measurementFrame: frame },
    ], presentationFrame: { ...frame, referenceFrame: 'sun-icrf', originM: [0, 0, 0] },
    interpretation: 'Each selectable lens retains its authenticated physical source, measurement frame and resources. All lenses share the explicitly authored presentation scale and bounds; no depth was inferred or reconstructed.' });
    const receipt = JSON.parse(await readFile(result.deliveryPath, 'utf8'));
    assert.equal(receipt.source, undefined);
    assert.deepEqual(receipt.sources.map((source: { lensId: string; resources: unknown[] }) => [source.lensId, source.resources.length]), [['regularized', 3], ['comparison', 3]]);
    for (const [path, bytes] of first.assets) assert.deepEqual(await readFile(resolve(first.destination, 'prepared/regularized', path)), bytes);
    for (const [path, bytes] of second.assets) assert.deepEqual(await readFile(resolve(first.destination, 'prepared/comparison', path)), bytes);
  } finally { await rm(first.root, { recursive: true, force: true }); await rm(second.root, { recursive: true, force: true }); }
});
