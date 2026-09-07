import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparePresentationBindings } from './prepared-presentation-bindings.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-prepared-bindings-'));
  const page = join(root, 'site/pages'); await mkdir(page, { recursive: true });
  await writeFile(join(page, 'fixture.astro'), '---\nimport "./fixture.css";\n---');
  const css = `.scene, .moving, .fixed, .leaf { position:absolute; top:0; left:0; transform-origin:0 0; }
    .scene, .moving, .fixed { transform-style:preserve-3d; }
    .leaf { width:10px; height:10px; backface-visibility:hidden; transform:translateZ(4px); }
    .moving { animation:spin 12s linear infinite; }
    [data-lens=slow] .moving { animation-duration:36s; }
    @keyframes spin { from { transform:rotateY(0deg); } to { transform:rotateY(360deg); } }`;
  const definition = { id: 'fixture', tree: { camera: 0, scene: 1, stageClasses: [], properties: [],
    nodes: [[-1, 'camera'], [0, 'scene'], [1, 'moving'], [2, 'leaf'], [1, 'fixed'], [4, 'leaf']]
      .map(([parent, className]) => ({ tag: 'div', parent, className, style: '', properties: [], attributes: {} })) },
    animations: [], viewBindings: [], materials: [], variants: ['fast', 'slow'].map(lensId => ({ when: { lensId },
      writes: [{ kind: 'attribute', target: -1, name: 'data-lens', value: lensId }] })) };
  const setCss = value => writeFile(join(page, 'fixture.css'), value);
  try { await setCss(css); await run({ root, definition, css, setCss }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('source CSS compiles selection timing and only immutable single-sided leaf planes', async () => fixture(async ({ root, definition }) => {
  const prepared = await preparePresentationBindings(definition, root);
  assert.equal(prepared.motion.length, 1);
  assert.equal(prepared.motion[0].target, 2);
  assert.equal(prepared.motion[0].duration, 12000);
  assert.deepEqual(prepared.motion[0].timings, [{ when: { lensId: 'slow' }, duration: 36000 }]);
  assert.deepEqual(prepared.facing, [{ target: 5, plane: [0, 0, 1, -4], tolerance: 2 ** -23 }]);
  // Selection visibility has another owner, even if its plane is unchanged.
  definition.variants[1].writes.push({ kind: 'style', target: 5, name: 'visibility', value: 'hidden' });
  assert.deepEqual((await preparePresentationBindings(definition, root)).facing, []);
}));

test('unsupported motion cannot silently become an unowned native animation', async () => fixture(async ({ root, definition, css, setCss }) => {
  await setCss(css + ' [data-lens=slow] .moving { animation:none; }');
  await assert.rejects(preparePresentationBindings(definition, root), /motion membership/);
  await setCss(css + ' @keyframes spin { from { opacity:0; } to { opacity:1; } }');
  await assert.rejects(preparePresentationBindings(definition, root), /linear transform keyframes/);
}));
