import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preparationRendererFindings, rendererUses, type RendererException } from './preparation-without-renderer.mts';

const path = 'packages/telescope-cli/src/sphere/publication.mts';
const exception: RendererException = { path, reason: 'Publishes a renderer scene.' };
const source = new Map([[path, "import { runtime } from '@cssearth/renderer';"]]);

test('named consumers pass, removing a needed exception fails, stale exceptions fail', () => {
  assert.deepEqual(preparationRendererFindings(source, [exception]), []);
  assert.match(preparationRendererFindings(source, [])[0]!, /must not depend on renderer/u);
  assert.match(preparationRendererFindings(new Map([[path, "import { data } from '@cssearth/objects';"]]), [exception])[0]!, /stale/u);
  assert.match(preparationRendererFindings(new Map(), [exception])[0]!, /stale/u);
});

test('an unlisted bake renderer import fails for static, dynamic, type and relative imports', () => {
  const path = 'packages/bake/src/probe.ts';
  for (const text of ["import { a } from '@cssearth/renderer';", "await import('@cssearth/renderer/universe');",
    "type A = typeof import('@cssearth/renderer');", "import { a } from '../../renderer/src/index.ts';",
    "const entry = new URL('../../../packages/renderer/src/volume/loader.ts', import.meta.url);"])
    assert.match(preparationRendererFindings(new Map([[path, text]]), [])[0]!, /must not depend on renderer/u);
  assert.deepEqual(preparationRendererFindings(new Map([[path, "// @cssearth/renderer\nconst example = '@cssearth/renderer';"]]), []), []);
});

test('dependency fields and tsconfig references require exact file exceptions', () => {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])
    assert.equal(rendererUses('packages/bake/package.json', JSON.stringify({ [field]: { '@cssearth/renderer': 'workspace:*' } })), true);
  assert.equal(rendererUses('packages/bake/tsconfig.node.json', JSON.stringify({ references: [{ path: '../renderer/tsconfig.json' }] })), true);
  assert.equal(rendererUses('packages/bake/tsconfig.json', JSON.stringify({ references: [{ path: '../objects' }] })), false);
  assert.deepEqual(preparationRendererFindings(new Map([['packages/bake/package.json', '{"dependencies":{"@cssearth/objects":"workspace:*"}}']]), []), []);
});

test('literal sibling URLs and configuration dependency mutations fail, restoration passes', () => {
  assert.equal(rendererUses('packages/bake/package.json', '{"imports":{"#safe":"@cssearth/renderer-example"}}'), false);
  for (const [path, bad, good] of [
    ['packages/bake/probe.mts', "new URL('../renderer/dist/index.js', import.meta.url)", "new URL('../objects/dist/index.js', import.meta.url)"],
    ['packages/bake/tsconfig.json', '{"extends":"../renderer/tsconfig.json"}', '{"extends":"../objects/tsconfig.json"}'],
    ['packages/bake/tsconfig.json', '{"compilerOptions":{"paths":{"alias":["../renderer/src/index.ts"]}}}', '{"compilerOptions":{"paths":{"alias":["../objects/src/index.ts"]}}}'],
    ['packages/bake/package.json', '{"imports":{"#runtime":"@cssearth/renderer"}}', '{"imports":{"#runtime":"@cssearth/objects"}}'],
  ]) {
    assert.deepEqual(preparationRendererFindings(new Map([[path!, good!]]), []), []);
    assert.match(preparationRendererFindings(new Map([[path!, bad!]]), [])[0]!, /must not depend on renderer/u);
    assert.deepEqual(preparationRendererFindings(new Map([[path!, good!]]), []), []);
  }
});
