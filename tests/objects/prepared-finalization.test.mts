import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { finalizeObjectJson } from '../../tools/prepare-object-json.mts';
import { requireRecord } from '../../tools/source-values.mts';
import { requirePreparedAssetManifest, verifyPreparedAssetClosure } from '../../src/platform/runtime-asset-closure.mts';
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function snapshot(objectDirectory: string) {
  const files = ['object.json', ...(await readdir(resolve(objectDirectory, 'prepared'), { withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => `prepared/${entry.name}`)];
  return Promise.all(files.sort().map(async path => [path, digest(await readFile(resolve(objectDirectory, path)))]));
}

test('real Mimas finalization stays staged and reproduces its finalized runtime', async () => {
  const root = resolve(import.meta.dirname, '../..'), objectDirectory = resolve(root, 'src/objects/mimas');
  const original = await snapshot(objectDirectory);
  const runtime: unknown = JSON.parse(await readFile(resolve(objectDirectory, 'prepared/runtime.json'), 'utf8'));
  const stage = await mkdtemp(resolve(tmpdir(), 'cssearth-finalization-'));
  try {
    const preparedDirectory = resolve(stage, 'prepared'); await mkdir(preparedDirectory);
    await copyFile(resolve(objectDirectory, 'prepared/scene.json'), resolve(preparedDirectory, 'scene.json'));
    const finalized = await finalizeObjectJson('mimas', runtime, { projectRoot: root, objectDirectory, preparedDirectory,
      descriptorPath: resolve(stage, 'object.json') });
    assert.deepEqual(finalized.definition, runtime);
    const descriptor = requireRecord(JSON.parse(await readFile(resolve(stage, 'object.json'), 'utf8')));
    const payload = await readFile(resolve(preparedDirectory, 'object.json'));
    assert.equal(requireRecord(descriptor.prepared).sha256, digest(payload));
    assert.equal(requireRecord(requireRecord(descriptor.properties).page).metadata !== undefined, true);
    assert.deepEqual(await snapshot(objectDirectory), original);
    assert.deepEqual(Object.keys(JSON.parse(payload.toString('utf8'))).sort(), ['data', 'format', 'id', 'schema', 'type']);
    assert.equal(payload.includes(Buffer.from('"$shared"')), false);
  } finally { await rm(stage, { recursive: true, force: true }); }
});

test('--keep-bindings refuses a copy of Mimas whose system node text was hand-edited', async () => {
  const root = resolve(import.meta.dirname, '../..'), objectDirectory = resolve(root, 'src/objects/mimas');
  const runtime = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, 'prepared/runtime.json'), 'utf8')));
  const nodes = requireRecord(runtime.tree).nodes as Record<string, unknown>[];
  const systemNode = nodes.findIndex(node => String(node.className ?? '').split(/\s+/u).includes('mimas-system'));
  assert.notEqual(systemNode, -1, 'fixture must still carry a mimas-system node');
  const original = String(nodes[systemNode]!.style ?? '');
  assert.match(original, /transform:matrix3d\(/u);
  // A 90-degree rotation is still a valid matrix3d, so only the drawn orientation
  // changes; the fixture stays otherwise well-formed, as a hand edit would leave it.
  const edited = { ...runtime, tree: { ...requireRecord(runtime.tree), nodes: nodes.map((node, index) => index === systemNode
    ? { ...node, style: original.replace(/transform:matrix3d\([^)]*\)/u, 'transform:matrix3d(0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1)') } : node) } };
  const stage = await mkdtemp(resolve(tmpdir(), 'cssearth-finalization-stale-'));
  try {
    const preparedDirectory = resolve(stage, 'prepared'); await mkdir(preparedDirectory);
    await copyFile(resolve(objectDirectory, 'prepared/scene.json'), resolve(preparedDirectory, 'scene.json'));
    await assert.rejects(finalizeObjectJson('mimas', edited, { projectRoot: root, objectDirectory, preparedDirectory,
      descriptorPath: resolve(stage, 'object.json') }, { keepBindings: true }), /--keep-bindings refused/);
  } finally { await rm(stage, { recursive: true, force: true }); }
});

test('--keep-bindings finalizes an unedited copy of Mimas normally', async () => {
  const root = resolve(import.meta.dirname, '../..'), objectDirectory = resolve(root, 'src/objects/mimas');
  const runtime: unknown = JSON.parse(await readFile(resolve(objectDirectory, 'prepared/runtime.json'), 'utf8'));
  const stage = await mkdtemp(resolve(tmpdir(), 'cssearth-finalization-keep-'));
  try {
    const preparedDirectory = resolve(stage, 'prepared'); await mkdir(preparedDirectory);
    await copyFile(resolve(objectDirectory, 'prepared/scene.json'), resolve(preparedDirectory, 'scene.json'));
    const finalized = await finalizeObjectJson('mimas', runtime, { projectRoot: root, objectDirectory, preparedDirectory,
      descriptorPath: resolve(stage, 'object.json') }, { keepBindings: true });
    assert.deepEqual(finalized.definition, runtime);
  } finally { await rm(stage, { recursive: true, force: true }); }
});

test('finalization inventories every baked prepared file and leaves out what a checkout regenerates', async () => {
  const root = resolve(import.meta.dirname, '../..'), objectDirectory = resolve(root, 'src/objects/mimas');
  const runtime: unknown = JSON.parse(await readFile(resolve(objectDirectory, 'prepared/runtime.json'), 'utf8'));
  const stage = await mkdtemp(resolve(tmpdir(), 'cssearth-finalization-prepared-assets-'));
  try {
    const preparedDirectory = resolve(stage, 'prepared'); await mkdir(preparedDirectory);
    await copyFile(resolve(objectDirectory, 'prepared/scene.json'), resolve(preparedDirectory, 'scene.json'));
    // provenance.json is regenerated on every checkout, so never inventoried; sky.json and the frame receipt are baked files and are.
    await copyFile(resolve(objectDirectory, 'prepared/provenance.json'), resolve(preparedDirectory, 'provenance.json'));
    await copyFile(resolve(objectDirectory, 'prepared/sky.json'), resolve(preparedDirectory, 'sky.json'));
    await finalizeObjectJson('mimas', runtime, { projectRoot: root, objectDirectory, preparedDirectory,
      descriptorPath: resolve(stage, 'object.json') });
    const manifest = requirePreparedAssetManifest('mimas', JSON.parse(await readFile(resolve(stage, 'prepared-assets.json'), 'utf8')));
    assert.equal(manifest.schema, 'cssmimas-prepared-assets@1');
    assert.equal(manifest.resourceRoot, 'prepared');
    assert.deepEqual(manifest.assets.map(a => a.filename).sort(), ['runtime.json', 'scene.json', 'sky.json', 'world-navigation.json']);
    assert.equal(await verifyPreparedAssetClosure({ planetId: 'mimas', manifest, root: preparedDirectory, closure: false }), true);
    // Mutation check: corrupting an inventoried file must fail verification even though provenance.json (not
    // inventoried) is untouched, proving the writer records real hashes rather than trusting its file list.
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(preparedDirectory, 'scene.json'), 'drifted');
    await assert.rejects(verifyPreparedAssetClosure({ planetId: 'mimas', manifest, root: preparedDirectory, closure: false }),
      /prepared asset drifted: scene\.json/);
  } finally { await rm(stage, { recursive: true, force: true }); }
});
