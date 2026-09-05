import assert from "node:assert/strict";
import test from "node:test";
import { createPreparedNodeTree, preparedDeclarations } from "./prepared-node-tree.mjs";
import { PREPARED_MOON_SCENE } from "../src/planets/moon/runtime/preparedScene.mjs";
test("preparation expands every actual Moon leaf into a stable ordered tree", () => {
  const tree = createPreparedNodeTree(), camera = tree.element("div", "polycss-camera"), scene = tree.element("div", "polycss-scene");
  tree.append(null, camera); tree.append(camera, scene);
  const body = tree.mesh("body"), material = tree.element("s"); tree.append(scene, body, material);
  const leaves = PREPARED_MOON_SCENE.body.bands.flatMap(band => band.leaves);
  for (const leaf of leaves) tree.append(body, tree.leaf(leaf));
  const result = tree.finish({ camera, scene, registrations: [{ bodySystem: body, lightingOverlays: [material] }] });
  assert.equal(result.tree.nodes.length, 4 + leaves.length + leaves.filter(leaf => leaf.projectiveTextureLayer).length);
  assert.equal(result.tree.nodes[result.index(material)].tag, "s");
  for (const [index, node] of result.tree.nodes.entries()) assert.ok(node.parent < index);
  for (const node of result.tree.nodes.filter(node => node.className === "polycss-projective-texture")) {
    const style = preparedDeclarations(node.style);
    for (const propertyId of node.properties) { const property=result.tree.properties[propertyId];if (property.custom) style.setProperty(property.name, property.value); else style[property.name] = property.value; }
    assert.equal(style.backgroundImage, "inherit"); assert.equal(style.transformStyle, "flat"); assert.match(style.transform, /^matrix3d\(/);
    assert.equal(result.tree.nodes[node.parent].tag, "s");
  }
});
test("preparer rejects unattached and doubly owned nodes", () => {
  const tree = createPreparedNodeTree(), camera = tree.element(), scene = tree.element(); tree.append(null, camera); tree.append(camera, scene);
  assert.throws(() => tree.append(camera, scene), /one owner/);
  tree.element(); assert.throws(() => tree.finish({ camera, scene, registrations: [] }), /unattached/);
});
