import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparePresentationBindings } from '@cssearth/bake/prepared-presentation';
import { objectPageStyles } from '../../site/object-page-contract.mts';
import { requireObjectRuntimeDefinition } from '@cssearth/bake/contract';
import type { PresentationSource } from '@cssearth/bake/prepared-presentation';
import type { PreparedTree, PreparedWrite } from '@cssearth/renderer/rendering/prepared-presentation.ts';

interface Fixture { root: string; definition: PresentationSource; css: string; setCss(value: string): Promise<void>; }
async function mimasRuntime(root: string): Promise<PresentationSource> {
  const raw: unknown = JSON.parse(await readFile(join(root, 'src/objects/mimas/prepared/runtime.json'), 'utf8'));
  return requireObjectRuntimeDefinition(raw);
}

async function fixture(run: (fixture: Fixture) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-prepared-bindings-'));
  const page = join(root, 'src/objects/fixture'); await mkdir(page, { recursive: true });
  await mkdir(join(root, 'site'));
  await writeFile(join(root, 'site/object-shell.css'), '');
  await writeFile(join(page, 'object.json'), JSON.stringify({id:'fixture', properties:{page:{stylesheets:['src/objects/fixture/fixture.css']}}}));
  const css = `.scene, .moving, .fixed, .leaf { position:absolute; top:0; left:0; transform-origin:0 0; }
    .scene, .moving, .fixed { transform-style:preserve-3d; }
    .leaf { width:10px; height:10px; backface-visibility:hidden; transform:translateZ(4px); }
    .moving { animation:spin 12s linear infinite; }
    [data-dataset=slow] .moving { animation-duration:36s; }
    @keyframes spin { from { transform:rotateY(0deg); } to { transform:rotateY(360deg); } }`;
  const runtime = await mimasRuntime(fileURLToPath(new URL('../../', import.meta.url)));
  const nodes: PreparedTree['nodes'][number][] = [];
  for (const [parent, className] of [[-1, 'camera'], [0, 'scene'], [1, 'moving'], [2, 'leaf'], [1, 'fixed'], [4, 'leaf']] as const) {
    nodes.push({ tag: 'div', parent, className, style: '', properties: [], attributes: {} });
  }
  const definition: PresentationSource = { id: 'fixture', camera: runtime.camera, tree: { camera: 0, scene: 1, stageClasses: [], properties: [], nodes },
    animations: [], viewBindings: [], materials: [], variants: ['fast', 'slow'].map(datasetId => ({ when: { datasetId }, required: [], materials: [],
      writes: [{ kind: 'attribute', target: -1, name: 'data-dataset', value: datasetId }] })) };
  const setCss = (value: string): Promise<void> => writeFile(join(page, 'fixture.css'), value);
  try { await setCss(css); await run({ root, definition, css, setCss }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('source CSS compiles selection timing', async () => fixture(async ({ root, definition }) => {
  const prepared = await preparePresentationBindings(definition, root, { pageStyles: objectPageStyles });
  assert.ok(prepared.motion);
  assert.equal(prepared.motion.length, 1);
  assert.equal(prepared.motion[0].target, 2);
  assert.equal(prepared.motion[0].duration, 12000);
  assert.deepEqual(prepared.motion[0].timings, [{ when: { datasetId: 'slow' }, duration: 36000 }]);
  // Back faces are the browser's: preparation publishes no facing planes.
  assert.equal('facing' in prepared, false);
}));

test('explicit two-sided source leaves keep their own style', async () => fixture(async ({ root, definition }) => {
  const tree = { ...definition.tree, nodes: definition.tree.nodes.map((node, index) => index === 5 ? { ...node, style: 'backface-visibility:visible' } : node) };
  const prepared = await preparePresentationBindings({ ...definition, tree }, root, { pageStyles: objectPageStyles });
  assert.equal(prepared.tree.nodes[5].style, 'backface-visibility:visible');
  assert.equal(prepared.tree.nodes.length, definition.tree.nodes.length);
}));

test('unsupported motion cannot silently become an unowned native animation', async () => fixture(async ({ root, definition, css, setCss }) => {
  await setCss(css + ' [data-dataset=slow] .moving { animation:none; }');
  await assert.rejects(preparePresentationBindings(definition, root, { pageStyles: objectPageStyles }), /motion membership/);
  await setCss(css + ' @keyframes spin { from { opacity:0; } to { opacity:1; } }');
  await assert.rejects(preparePresentationBindings(definition, root, { pageStyles: objectPageStyles }), /linear transform keyframes/);
}));

test('repreparation starts from canonical topology and reproduces the final depth transport', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const source = await mimasRuntime(root);
  const first = await preparePresentationBindings(source, root, { pageStyles: objectPageStyles });
  assert.ok(first.surfaceHit && first.depthPartitions && first.tree.activationGroups);
  const second = await preparePresentationBindings(first, root, { pageStyles: objectPageStyles });
  assert.deepEqual(second, first);
  assert.ok(first.depthPartitions.groups.length > 1);
  // The shared shell gives every mesh an identity translate for WebKit layer
  // residency. It must not disable static partitioning; real offsets still do.
  const translated: PresentationSource = { ...source, tree: { ...source.tree, nodes: source.tree.nodes.map((node, id) =>
    id === source.surfaceHit?.target ? { ...node, style: `${node.style};translate:1px 0px 0px` } : node) } };
  assert.equal((await preparePresentationBindings(translated, root, { pageStyles: objectPageStyles })).depthPartitions, undefined);
  assert.ok(first.tree.activationGroups.length < 40);
  // A new local frame owner invalidates the old partition instead of retaining
  // a cached layout that can no longer follow that source's material state.
  const changed: PresentationSource = { ...first, viewBindings: [...first.viewBindings, { kind: 'view-property', target: first.surfaceHit.target,
    property: '--local-material', source: 'billboard-opacity', precision: 6 }] };
  assert.equal((await preparePresentationBindings(changed, root, { pageStyles: objectPageStyles })).depthPartitions, undefined);
});

test('texture consumers are prepared from CSS inheritance and nearer overrides', async () => fixture(async ({ root, definition, css, setCss }) => {
  await setCss(css + ' .leaf { background-image:var(--texture); }');
  const prepared = await preparePresentationBindings({ ...definition, variants: definition.variants.map(variant => ({ ...variant,
    writes: [...variant.writes,
      { kind: 'texture', target: 1, name: '--texture', resource: 'base', quoted: true },
      { kind: 'texture', target: 4, name: '--texture', resource: 'override', quoted: true }],
  })) }, root, { pageStyles: objectPageStyles });
  assert.deepEqual(prepared.tree.textureBindings, [
    { target: 1, name: '--texture', leaves: [3] },
    { target: 4, name: '--texture', leaves: [5] },
  ]);
}));
