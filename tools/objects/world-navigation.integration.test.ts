import { readFile, readdir, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { prepareWorldNavigationDefinition } from './prepare-world-navigation.js';
import { rotation, transform } from './world-navigation.js';
import { chain } from './world-navigation-sources.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const directories = (await readdir(resolve(root, 'src/planets'), { withFileTypes: true })).filter(entry => entry.isDirectory());
const objects = [];
for (const entry of directories) {
  const directory = resolve(root, 'src/planets', entry.name);
  try { objects.push({ directory, descriptor: await read(resolve(directory, 'object.json')) }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

for (const { directory, descriptor } of objects) it(`${descriptor.id}: source-pinned finalization is idempotent and preserves detailed assets/geometry`, async () => {
  const definition = await read(resolve(directory, 'prepared/runtime.json'));
  const first = await prepareWorldNavigationDefinition({ objectDirectory: directory, definition, projectRoot: root });
  const second = await prepareWorldNavigationDefinition({ objectDirectory: directory, definition: first.definition, projectRoot: root });
  assert.deepEqual(second, first);
  assert.deepEqual(first.frame, descriptor.properties.worldFrame);
  assert.doesNotThrow(() => rotation(first.frame.presentationToReference));
  assert.equal(first.definition.tree, definition.tree);
  assert.equal(first.definition.assets, definition.assets);
  assert.equal(first.definition.controls, definition.controls);
  assert.equal(first.definition.camera.maximumZoom, definition.camera.maximumZoom);
  assert.equal(first.definition.camera.projection.model, 'css-perspective-shared-with-sky');
  if (descriptor.properties.recipe.paging) {
    assert.ok(first.definition.camera.dolly.minimumDistanceRadii < 1.000001);
    assert.ok(first.definition.camera.maximumZoom > 1000);
  }
  if (!descriptor.properties.recipe.sources.some((source: { id: string }) => source.id === 'world-context')) {
    assert.equal(first.frame.bodyRadiusM, descriptor.properties.recipe.shape.radiusKm * 1000);
    assert.equal(first.definition.sky.cameraContract, 'scene-locked-unbounded-accumulated-matrix3d');
    // Check the source-derived basis against the actual retained surface carrier,
    // independently of the family adapter's authored field selection.
    const nodes = definition.tree.nodes;
    let index = nodes.findIndex((node: { className: string | null }) => node.className?.split(' ').includes(`${descriptor.id}-body`));
    assert.ok(index >= 0, 'Retained surface carrier is missing.');
    const transforms: string[] = [];
    const retainedTransform = (node: any): string => node.properties.map((propertyIndex: number) => definition.tree.properties[propertyIndex])
      .find((entry: { name: string }) => entry.name === 'transform')?.value ?? node.style.match(/(?:^|;)transform:([^;]+)/u)?.[1] ?? '';
    const physicalSource = descriptor.properties.recipe.sources.find((source: { id: string }) => source.id === 'solar-system');
    if (physicalSource) {
      // The physical observation capability anchors Sun, orbit and sky to its
      // prepared system. Its local surface/cutaway spin is a visual longitude
      // phase, not a second inertial reference frame. It must preserve the pole.
      assert.equal((await read(resolve(directory, physicalSource.path))).schema, 'cssearth-solar-system-preparation@1');
      const pole = transform(chain(retainedTransform(nodes[index])), [0, 0, 1]);
      pole.forEach((value, axis) => assert.ok(Math.abs(value - Number(axis === 2)) < 1e-12));
      index = nodes[index].parent;
    }
    while (index !== definition.tree.scene) {
      const node = nodes[index];
      assert.ok(node, 'Surface chain escaped the retained scene.');
      transforms.unshift(retainedTransform(node));
      index = node.parent;
    }
    const rendered = chain(...transforms), authored = first.receipt.bodyToPresentation;
    assert.ok(authored);
    rendered.forEach((value, axis) => assert.ok(Math.abs(value - authored[axis]) < 1e-12, `${descriptor.id} surface axis ${axis} differs.`));
  }
});

it('descriptor discovery covers every authored object rather than a navigation-menu filter', () => {
  assert.ok(objects.length > 8);
  assert.ok(objects.some(({ descriptor }) => descriptor.properties.recipe.paging));
  assert.ok(objects.some(({ descriptor }) => descriptor.properties.recipe.rings));
});

it('changed authored bytes fail the finalizer source pin before publication', async () => {
  const object = objects.find(({ descriptor }) => descriptor.properties.recipe.paging)!;
  const temporary = await mkdtemp(resolve(tmpdir(), 'physical-source-pin-'));
  try {
    await writeFile(resolve(temporary, 'object.json'), JSON.stringify(object.descriptor));
    const source = object.descriptor.properties.recipe.sources[0];
    const target = resolve(temporary, source.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${await readFile(resolve(object.directory, source.path), 'utf8')} `);
    const definition = await read(resolve(object.directory, 'prepared/runtime.json'));
    await assert.rejects(prepareWorldNavigationDefinition({ objectDirectory: temporary, definition, projectRoot: root }), /Navigation source pin differs/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
