import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateSourceManifest } from '../../../src/platform/source-manifest.mts';
import { prepareDirectionalSun } from '../../../src/platform/prepare-directional-sun.mts';
import { assertPolarCaps, poleOfClass } from '../../../tests/objects/polar-caps.mts';
import { parsePagedProfile } from './profile-source.mts';
import { parseInteriorSource } from './source-contract.mts';
import { createAtmospherePreparation } from './atmosphere.mts';
import { createPagedSurfaceRaster } from './surface-raster.mts';
import { prepareEllipsoidAttitude } from './attitude.mts';
import { preparePagedEllipsoidScene } from './scene.mts';

const source = resolve(import.meta.dirname, '../../../src/objects/earth/source');
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(source, path), 'utf8'));
type AtmosphereModel = Parameters<typeof preparePagedEllipsoidScene>[0]['atmosphereModel'];

/** Earth's scene plan from its tracked recipe. The bake reads the atmosphere model from the decoded Blue Marble; the plan
 * only records it beside the material bank, so a stand-in takes its place here. No cap reads it. */
async function earthScene() {
  const config = parsePagedProfile(await json('preparation/paged-ellipsoid.json'));
  const atmosphere = createAtmospherePreparation({ config, sourceDirectory: source, sourceManifest: validateSourceManifest('earth', await json('manifest.json')),
    sun: prepareDirectionalSun(), polarToEquatorial: config.polarRadiusKm / config.equatorialRadiusKm });
  const atmosphereModel = { outerRadiusRatio: 1, profile: {}, atmosphereSource: 'stand-in', law: { paths: [] }, reference: [0, 0, 0],
    referenceSource: 'stand-in' } as unknown as AtmosphereModel;
  const attitude = prepareEllipsoidAttitude('earth', { meshRotationZDegrees: config.geometry.MESH_ROTATION_Z, mapLeftEdgeLongitudeDeg: 0 });
  return preparePagedEllipsoidScene({ config, interiorSource: parseInteriorSource(await json(config.interiorPath)), atmosphereModel, atmosphere,
    raster: createPagedSurfaceRaster(config), attitude }).scene;
}

function assertFamily(owner: string, leaves: readonly { className: string; style: string }[]) {
  const caps = leaves.filter(leaf => /-polar\b/u.test(leaf.className));
  assert.equal(caps.length, 2, `${owner}: one cap at each pole`);
  assertPolarCaps(owner, caps.map(leaf => ({ pole: poleOfClass(leaf.className), style: leaf.style, label: leaf.className })));
  assert.ok(leaves.filter(leaf => !caps.includes(leaf)).every(leaf => !leaf.style.includes('border-radius')), `${owner}: bands keep their own shape`);
}

test("the globe's caps, the cutaway's outer poles and every interior shell's caps follow the one cap rule", async () => {
  const scene = await earthScene();
  assertFamily('earth globe', scene.body.bands.flatMap(band => band.leaves));
  assertFamily('earth cutaway outer body', scene.interior.outerBodyBands.flatMap(band => band.leaves));
  assert.ok(scene.interior.shells.length > 0, 'earth: the cutaway has interior shells');
  for (const shell of scene.interior.shells) assertFamily(`earth ${shell.id} shell`, shell.leaves);
});
