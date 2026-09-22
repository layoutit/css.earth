import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { readPreparedFixture } from '../../fixtures.mts';
const [scene, runtime] = await Promise.all([readPreparedFixture('saturn','scene'),readPreparedFixture('saturn','runtime')]);
const css = await readFile(new URL('../../../../src/renderers/css/styles/saturn-surfaces.css', import.meta.url), 'utf8');

test('retains all source longitudes without the unused visibility-bank machinery', () => {
  assert.equal(scene.schema, 'csssaturn-prepared-runtime-scene@1');
  assert.equal(scene.transport.sourceSchema, 'csssaturn-prepared-retained-scene@30');
  assert.equal(scene.bodyBands.length, 16);
  for (const [index, band] of scene.bodyBands.entries()) {
    assert.equal(band.leaves.length, index === 0 || index === 15 ? 2 : 32);
    for (const leaf of band.leaves) {
      assert.equal(leaf.tag, 's');
      assert.equal(required(leaf.projectiveTextureLayer).rasterScale, 2);
      assert.match(required(leaf.projectiveTextureLayer).frameMatrix, /^[-\d.,e]+$/);
    }
  }
  assert.equal(scene.bodyBands.flatMap(band => band.leaves).length, 452);
  assert.equal('planetFaceRetention' in scene, false);
  assert.doesNotMatch(JSON.stringify(runtime), /bodyVisibility|statesBase64|saturn-inner-fill/);
});

test('closes both polar seams under one fixed prepared material plane', async () => {
  const leaves = [scene.bodyBands[0], scene.bodyBands[15]].flatMap(band => band.leaves);
  for (const [key, value] of Object.entries({polarInnerLeafCount:2, polarSurfaceLeafCount:2, fixedMaterialPlaneLeafCount:1, planetPolygonCount:453, polygonCount:938, textureLeafCount:938})) assert.equal(scene.counts[key], value);
  assert.equal('innerFill' in scene, false);
  for (const leaf of leaves) {
    assert.match(leaf.style, /--polycss-atlas-width:512px/);
    assert.match(leaf.style, /--polycss-atlas-height:512px/);
    assert.match(leaf.style, /background-image:url\(\/scenes\/saturn\/saturn-poles.webp\)/);
  }
  const metadata = await sharp(new URL('../../../../public/scenes/saturn/saturn-poles.webp', import.meta.url).pathname).metadata();
  assert.equal(metadata.width, 4096);
  assert.equal(metadata.height, 512);
  assert.equal(runtime.tree.nodes.filter(node => node.className === 'saturn-exterior-material').length, 1);
  assert.match(scene.fixedMaterialPlane.leaf.style, /saturn-orbit-material.webp/);
});

test('keeps axial tilt and latitude-band phase independent from camera input', () => {
  assert.equal(scene.camera.state.zoom, 1.1);
  assert.match(scene.camera.sceneStyle, /scale\(0\.022(?:0+2)?\)/);
  assert.match(scene.camera.sceneStyle, /rotateX\(40deg\)/);
  assert.equal(scene.systemTransform, 'transform:rotateZ(60deg) rotateY(-26.73deg)');
  assert.equal(scene.preparedMotion.obliquityDegrees, 26.73);
  assert.equal(scene.preparedRingSource.shadowModel.systemTiltDegrees, 26.73);
  assert.equal(scene.preparedRingSource.shadowModel.systemNodeDegrees, -60);
  assert.deepEqual(scene.bodyBands.map(band => band.visualRotationSeconds), Array(16).fill(72));
  for (const node of runtime.tree.nodes.filter(node => node.className === 'polycss-mesh saturn-system')) assert.equal(node.style, scene.systemTransform);
  assert.doesNotMatch(css, /saturn-system-drift|\.saturn-system\s*\{[^}]*animation-/s);
});

test('uses the shared material track with prepared dense orbit addresses', () => {
  const exterior = required(runtime.materials.find((track: { id: string; }) => track.id === 'exterior'));
  assert.equal(exterior.frame.count, 256);
  assert.equal(required(exterior.rotation).kind, 'ellipsoid');
  assert.ok(exterior.banks.every(bank => bank.frames.length === 256));
  assert.doesNotMatch(JSON.stringify(runtime), /weatherPlayer|publishAtlas|publishFrame|createElement/);
  assert.match(css, /\.saturn-body\s*\{[^}]*animation-name:\s*saturn-body-spin;/su);
  assert.match(css, /\.saturn-ring-orbit\s*\{[^}]*animation-name:\s*saturn-ring-orbit;/su);
});
