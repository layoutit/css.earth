import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { readPreparedFixture } from '../../fixtures.mts';
import { SCENE_OBJECTS } from '../../../../site/objects.mts';
const [scene, runtime] = await Promise.all([readPreparedFixture('saturn','scene'),readPreparedFixture('saturn','runtime')]);
const root = new URL('../../../../', import.meta.url);
const readJson = async (path: string|URL) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const manifest = await readJson('src/objects/saturn/inventory.json');
const geometry = await readJson('src/objects/saturn/source/preparation/geometry.json');
const exterior = required(runtime.materials.find((track: { id: string; }) => track.id === 'exterior'));
async function verifiedAsset(url: string) {
  const pin = array(shape({filename:text,bytes:number,sha256:text}))(manifest.assets).find(asset => url === `/scenes/saturn/${asset.filename}`);
  assert.ok(pin, `${url} must belong to the active runtime closure`);
  const bytes = await readFile(new URL(`public${url}`, root));
  assert.equal(bytes.length, pin.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  return bytes;
}

test('ships every active material bank with exact pinned bytes and prepared addresses', async () => {
  const lighting = scene.preparedLighting;
  assert.equal(lighting.mode, 'prepared-view-bank-single-material-plane-orbit-projection');
  assert.equal(exterior.frame.count, 256);
  assert.equal(exterior.banks.length, 16);
  assert.ok(exterior.rotation && exterior.rotation.kind === 'ellipsoid');
  assert.equal(required(exterior.rotation).projection.coverageScale, 1.002);
  const variants = lighting.orbitAtlas.runtimeShards.variants;
  assert.deepEqual(exterior.banks.map(bank => bank.id), Object.keys(variants));
  const distinctHashes = new Set();
  for (const bank of exterior.banks) {
    const resource = required(runtime.assets.entries.find(entry => entry.key === required(bank.default).resource));
    assert.ok(resource);
    assert.equal(resource.url, variants[bank.id].runtimeAtlas.assetUrl);
    const bytes = await verifiedAsset(resource.url);
    distinctHashes.add(createHash('sha256').update(bytes).digest('hex'));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 5188);
    assert.equal(metadata.height, 4160);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(bank.frames.length, 256);
    for (const [index, frame] of bank.frames.entries()) {
      const prepared = variants[bank.id].presentations[index];
      assert.equal(frame.resource, required(bank.default).resource);
      assert.equal(frame.backgroundPosition, prepared.backgroundPosition);
      assert.equal(frame.backgroundSize, prepared.backgroundSize);
    }
  }
  assert.equal(distinctHashes.size, 16);
  assert.equal(required(exterior.banks[0].default).backgroundPosition, '-4162px -2px');
  assert.equal(required(exterior.banks[0].default).backgroundSize, '5188px 4160px');
  assert.equal(lighting.orbitAtlas.runtimeShards.maximumRetainedAtlasCount, 1);
  assert.equal(required(runtime.assets.pools.find((pool: { id: string; }) => pool.id === 'exterior-material')).capacity, 2);
});

test('preserves source-owned solar, atmosphere, and ring-shadow preparation', () => {
  const expected = {solarEffectiveTemperatureKelvin:5772, objectSolarAlbedoMultiplier:'#fff1ea', planetFixedMaterialContentScale:.992, planetFixedMaterialCoverageScale:1.002, planetFixedMaterialDepthBias:.5, atmosphereMaximumAlpha:.72, atmosphereLimbExponent:1.75, atmosphereNightFloor:.22};
  for (const [key, value] of Object.entries(expected)) assert.equal(geometry.parameters[key], value);
  assert.equal(geometry.parameters.planetOrbitMaterialFrameCount, exterior.frame.count);
  assert.equal(scene.preparedRingSource.shadowModel.systemTiltDegrees, 26.73);
  assert.equal(scene.preparedRingSource.shadowModel.systemNodeDegrees, -60);
  assert.equal(runtime.sky.runtimeRasterization, false);
  assert.doesNotMatch(JSON.stringify(runtime), /"runtimeLightingMath":true|"runtimeRasterization":true|createElement/);
});

test('retains the cropped ring-shadow bitmap on its original logical plane', async () => {
  const bytes = await verifiedAsset('/scenes/saturn/saturn-ring-shadow.webp');
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 469);
  assert.equal(metadata.height, 342);
  const leaf = scene.ringShadowPlane;
  assert.match(leaf.style, /--polycss-atlas-width:1024px/);
  assert.match(leaf.style, /--polycss-atlas-height:1024px/);
  assert.match(leaf.style, /background-position:271px 672px/);
  assert.match(leaf.style, /background-size:469px 342px/);
  assert.equal(leaf.projectiveTextureLayer.rasterScale, 2);
  assert.equal(scene.counts.ringShadowPlaneCount, 1);
});

test('warms active material assets before declaring ready, with no private sky or Sun', () => {
  for (const key of ['exterior:normal', 'ring-shadow']) assert.ok(runtime.assets.startup.includes(key));
  assert.equal(runtime.assets.entries.some((entry: { key: string; }) => entry.key.startsWith('sky:') || entry.key === 'directional-sun'), false);
  assert.ok(SCENE_OBJECTS.some(object => object.id === 'saturn'));
  assert.doesNotMatch(JSON.stringify(runtime), /devicePixelRatio|createPreparedSaturn|loadPreparedOrbitBank|DecompressionStream/);
});

test('ships the pinned HD surface with direct prepared longitude sampling', async () => {
  const surface = scene.preparedSurface;
  const bytes = await verifiedAsset(surface.assetUrl);
  assert.equal(bytes.length, surface.assetBytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), surface.assetSha256);
  assert.equal(surface.faceCount, 448);
  assert.equal(surface.uvLayout, 'equirectangular-2-to-1-direct-longitude-latitude');
  assert.equal(surface.equivalentBodySampleWidth, 2048);
  assert.equal(surface.equivalentBodySampleHeight, 896);
  for (const [key, value] of Object.entries({seamBleed:0,topologyOverlap:0,presentationOverlap:.008,rasterGutter:16,runtimeEdgeDiscovery:false})) assert.equal(surface.seamRepair[key], value);
});
