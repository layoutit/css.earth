import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createPreparedNodeTree, preparedDeclarations, LEAF_BOX_UNSCALE, leafBoxLengths } from "@cssearth/bake/presentation";
import PREPARED_MOON_SCENE from "../../src/objects/moon/prepared/scene.json" with { type: "json" };
test("preparation expands every actual Moon leaf into a stable ordered tree", () => {
  const tree = createPreparedNodeTree(), camera = tree.element("div", "polycss-camera"), scene = tree.element("div", "polycss-scene");
  tree.append(null, camera); tree.append(camera, scene);
  const body = tree.mesh("body"), material = tree.element("s"); tree.append(scene, body, material);
  const leaves = PREPARED_MOON_SCENE.body.leaves;
  for (const leaf of leaves) tree.append(body, tree.leaf(leaf));
  const result = tree.finish({ camera, scene });
  assert.equal(result.tree.nodes.length, 4 + leaves.length);
  assert.equal(result.tree.nodes[result.index(material)].tag, "s");
  for (const [index, node] of result.tree.nodes.entries()) assert.ok(node.parent < index);
  assert.equal(result.tree.nodes.filter(node => node.className === "polycss-projective-texture").length, 0);
});
test('one prepared raster plane preserves the full projective mapping and scaled texture addresses', () => {
  const frame = [2,1,0,0,-1,3,.5,0,0,0,1,0,20,-30,50,1];
  const texture = [1,0,0,.001,0,1,0,-.002,0,0,1,0,0,0,0,1];
  const builder = createPreparedNodeTree(), camera = builder.element(), scene = builder.element();
  builder.append(null, camera); builder.append(camera, scene);
  const leaf = builder.leaf({ style: 'width:32px;height:16px;background-position:-8px -12px;background-size:512px 256px;background-image:url(/prepared.webp)',
    projectiveTextureLayer: { schema: 'polycss-prepared-projective-texture-layer@1', frameMatrix: frame.join(','), textureMatrix: texture.join(','), rasterScale: 4 } });
  builder.append(scene, leaf);
  const { tree, index } = builder.finish({ camera, scene }), node = tree.nodes[index(leaf)], style = preparedDeclarations(node.style);
  for (const propertyId of node.properties) { const property = tree.properties[propertyId]; if (property.custom) style.setProperty(property.name, property.value); else Reflect.set(style, property.name, property.value); }
  assert.equal(tree.nodes.length, 3); assert.equal(leaf.children.length, 0);
  // Every length follows the leaf's box factor (bake/presentation/leaf-box.ts); at its fallback of one the leaf keeps the full raster scale.
  assert.equal(style.width, leafBoxLengths('128px')); assert.equal(style.height, leafBoxLengths('64px'));
  assert.equal(style.backgroundSize, leafBoxLengths('2048px 1024px'));
  assert.equal(style.backgroundPosition, leafBoxLengths('-32px -48px'));
  assert.equal(style.backgroundImage, 'url(/prepared.webp)');
  assert.ok(style.transform.endsWith(`) ${LEAF_BOX_UNSCALE}`));
  const combined = style.transform.slice(9, style.transform.indexOf(')')).split(',').map(Number);
  const apply = (matrix: readonly number[], point: readonly number[]) => [0, 1, 2, 3]
    .map(row => point.reduce((sum, value, column) => sum + matrix[column * 4 + row] * value, 0));
  for (const point of [[0,0,0,1], [128,0,0,1], [0,64,0,1], [128,64,0,1], [43,21,0,1]]) {
    const expected = apply(frame, apply(texture, point)), actual = apply(combined, point);
    actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1e-12));
  }
});
test("preparer rejects unattached and doubly owned nodes", () => {
  const tree = createPreparedNodeTree(), camera = tree.element(), scene = tree.element(); tree.append(null, camera); tree.append(camera, scene);
  assert.throws(() => tree.append(camera, scene), /one owner/);
  tree.element(); assert.throws(() => tree.finish({ camera, scene }), /unattached/);
});
