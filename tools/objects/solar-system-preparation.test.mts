import { requireRecord, requireString, requireFiniteNumber, requireArray } from '../source-values.mts';
import { requireObjectRuntimeDefinition } from '../object-runtime-contract.mts';
import { shape, array, text, number } from './terrestrial-layers/source-records.mts';
import { required } from '../test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareSolarSystemCamera, prepareSolarSystemScene, prepareSolarSystemSunPresentation } from "./solar-system-scene.mts";
import { prepareSolarSystemPresentation } from "./solar-system-presentation.mts";
import { prepareSolarSystemMarkerStrip } from "./solar-system-markers.mts";
import { readJsonSource } from '../source-values.mts';
import { PREPARED_NAVIGATION_MARKERS } from "../../site/prepared-navigation-markers.mjs";
import { prepareCatalogueStars } from "../../src/platform/prepare-catalogue-stars.mts";
import { preparePlanetDirectionalSun } from "../../src/platform/prepare-directional-sun.mts";
import { loadAstronomyPackage } from "../../src/platform/astronomy-package.mts";
import { SOLAR_GEOMETRY_EPOCH_JD_TT } from "../../src/platform/solar-geometry.mts";
import type { Vec3 } from "@cssearth/astronomy";

// The prepared fixtures are generated, ignored files: read them at run time so
// the typecheck does not depend on a prepared checkout. Their shapes are the
// producers' own return and parameter types, checked further by the comparisons below.
type SceneConfig = Parameters<typeof prepareSolarSystemScene>[0];
type PreparedScene = Awaited<ReturnType<typeof prepareSolarSystemScene>> & { body: { leaves: { style: string; polarCap: string | null }[] }; bodyLeaves: { style: string; polar?: unknown }[] };
type PreparedSun = SceneConfig['sun'] & { distanceScaling: { meanHeliocentricDistanceAu: number }; asset: { generator: string }; provenance: { sourcePath: string } };
type PhaseAtlas = NonNullable<Parameters<typeof prepareSolarSystemPresentation>[0]['phaseAtlas']>;
type PreparedAssets = { lighting: { banks: Record<string, { billboard: Omit<PhaseAtlas, 'minimumLightViewZ' | 'maximumLightViewZ' | 'baseLightAzimuthDegrees'> }>;
  minimumLightViewZ: number; maximumLightViewZ: number; baseLightAzimuthDegrees: number; presentationFrameSize: number } };
type PreparedStrip = Awaited<ReturnType<typeof prepareSolarSystemMarkerStrip>>['plan'];
const prepared = async <T,>(id: string, file: string) => requireRecord(await readJsonSource(new URL(`../../src/planets/${id}/prepared/${file}`, import.meta.url))) as T;
const [mercuryScene, mercurySky, mercurySun, mercuryAssets, mercuryStrip, venusScene, venusSky] = await Promise.all([
  prepared<PreparedScene>('mercury', 'scene.json'), prepared<SceneConfig['starfield']>('mercury', 'sky.json'), prepared<PreparedSun>('mercury', 'sun.json'),
  prepared<PreparedAssets>('mercury', 'assets.json'), prepared<PreparedStrip>('mercury', 'markers.json'),
  prepared<PreparedScene>('venus', 'scene.json'), prepared<SceneConfig['starfield']>('venus', 'sky.json')]);
const mercuryPresentation = requireObjectRuntimeDefinition(await readJsonSource(new URL('../../src/planets/mercury/prepared/runtime.json', import.meta.url)));
const mercuryView = required(mercuryPresentation.heliocentricView, 'Mercury heliocentric view');

const mercuryConfig: Parameters<typeof prepareSolarSystemScene>[0] = { bodyId: "mercury", bodyRadiusUnits: 230, bodyRadiusKilometers: 2439.7,
  defaultZoom: 1.1, geometryScale: 1, starfield: mercurySky, sun: mercurySun };
const mercuryPrepared = await prepareSolarSystemScene(mercuryConfig);
const catalogue = await prepareCatalogueStars({ fovDegrees: 60 });
const phaseAtlas = { ...mercuryAssets.lighting.banks["2"].billboard,
  minimumLightViewZ: mercuryAssets.lighting.minimumLightViewZ,
  maximumLightViewZ: mercuryAssets.lighting.maximumLightViewZ,
  baseLightAzimuthDegrees: mercuryAssets.lighting.baseLightAzimuthDegrees };
assert.equal(mercuryStrip.model, 'synthetic-flat-colour-discs');
if (mercuryStrip.model !== 'synthetic-flat-colour-discs') throw new Error('Unexpected marker fixture model');
const systemMarkerStrip: NonNullable<Parameters<typeof prepareSolarSystemPresentation>[0]['systemMarkerStrip']> = { ...mercuryStrip, model: mercuryStrip.model };
const presentationConfig: Parameters<typeof prepareSolarSystemPresentation>[0] = { bodyId: "mercury", plan: mercuryPrepared.heliocentricView,
  navigationMarkers: PREPARED_NAVIGATION_MARKERS, markerAtlasUrl: "/navigation/body-sun@2x.webp",
  systemMarkerStrip, phaseAtlas, captionNames: required(mercuryView.labels, 'Mercury view labels').names, catalogue };
const tiles = [
  { id: "ceres", color: [110, 106, 102], size: 5 },
  { id: "eris", color: [232, 230, 226], size: 6 },
  { id: "haumea", color: [217, 216, 212], size: 5 },
  { id: "makemake", color: [185, 138, 106], size: 5 },
];

test("Mercury retained leaf mapping and shared delivery remain source-bound and demand driven", () => {
  const presentation = structuredClone(mercuryPresentation);
  assertPreparedProjectiveMappings(presentation, mercuryScene);
  const view = required(presentation.heliocentricView, 'Mercury heliocentric view'), systemMarkers = required(view.systemMarkers, 'Mercury system markers');
  for (const [id, marker] of Object.entries({mercury: view.bodyMarker, sun: systemMarkers.sun, ...systemMarkers.bodies})) {
    if (!marker.url?.startsWith('/scenes/')) {
      assert.equal(marker.count, PREPARED_NAVIGATION_MARKERS[id].count, `${id}: body sprite count`);
      assert.equal(marker.index, PREPARED_NAVIGATION_MARKERS[id].index, `${id}: body sprite index`);
    }
  }
  assert.ok(presentation.assets.startup.every(key => !key.startsWith("sky:") && !key.startsWith("interior:")));
  assert.ok(presentation.variants.filter(v => v.when.lensId === "interior").every(v => v.required.includes("interior:section")));
  assert.deepEqual(mercuryScene.worldFrame, mercuryPrepared.worldFrame);
});

// Compare the current direct-leaf matrix against its independent authored
// carrier/texture factors; rebuilding a retired transport is unnecessary.
function assertPreparedProjectiveMappings(input: unknown, scene: unknown) {
  const presentation = requireObjectRuntimeDefinition(input);
  const sourceLeaves = new Map<string, { frameMatrix: string; textureMatrix: string }>();
  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(collect); return; }
    const record = requireRecord(value);
    if (record.projectiveTextureLayer) sourceLeaves.set(requireString(record.style),
      shape({frameMatrix: text, textureMatrix: text})(record.projectiveTextureLayer));
    Object.values(record).forEach(collect);
  };
  collect(scene);
  const matrix = (value: string) => {
    const result = value.split(',').map(Number);
    assert.equal(result.length, 16); assert.ok(result.every(Number.isFinite)); return result;
  };
  const apply = (matrix: readonly number[], point: readonly number[]) => [0, 1, 2, 3].map(row =>
    point.reduce((sum, value, column) => sum + matrix[column * 4 + row] * value, 0));
  let checked = 0;
  for (const node of presentation.tree.nodes) {
    if (node.attributes['data-prepared-projection'] !== 'single-leaf') continue;
    const layer = required(sourceLeaves.get(node.style), 'Direct raster must retain its authored geometry');
    const assignments = node.properties.map(id => required(presentation.tree.properties[id]));
    const transform = required(assignments.find(value => value.name === 'transform'));
    const direct = matrix(transform.value.slice(9, -1)), frame = matrix(layer.frameMatrix), texture = matrix(layer.textureMatrix);
    for (const point of [[1,0,0,0], [0,1,0,0], [0,0,1,0], [0,0,0,1]]) {
      const expected = apply(frame, apply(texture, point));
      apply(direct, point).forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1e-10,
        'Direct leaf must preserve its authored projective mapping'));
    }
    checked++;
  }
  assert.ok(checked > 0, 'The real fixture must exercise direct projective leaves');
}

test("registered descriptors publish the generated physical frames and exact payload identities", async () => {
  for (const [id, scene] of [["mercury", mercuryScene], ["venus", venusScene]] as const) {
    const descriptor = JSON.parse(await readFile(new URL(`../../src/planets/${id}/object.json`, import.meta.url), "utf8"));
    assert.deepEqual(descriptor.properties.worldFrame, scene.worldFrame);
    const payload = await readFile(new URL(`../../src/planets/${id}/${descriptor.prepared.url}`, import.meta.url));
    assert.equal(createHash("sha256").update(payload).digest("hex"), descriptor.prepared.sha256);
  }
});

test("shared physical scene reproduces every existing Mercury subplan byte for byte", () => {
  for (const key of ["camera", "systemTransform", "presentationFrame", "heliocentricView", "starfield"] as const) {
    assert.equal(JSON.stringify(mercuryPrepared[key]), JSON.stringify(mercuryScene[key]), key);
  }
});

test("shared marker and phase assembly preserves Mercury with only its referenced captions", () => {
  const prepared = prepareSolarSystemPresentation(presentationConfig);
  const expected = structuredClone(mercuryView);
  const system = required(required(expected.plan, 'Mercury view plan').system, 'Mercury system plan'), labels = required(expected.labels, 'Mercury view labels');
  const ids = ['mercury', 'sun', ...system.bodies.map(body => body.id)];
  Object.assign(labels, { names: Object.fromEntries([...new Set(ids)].map(id => [id, requireString(requireRecord(labels.names)[id])])) });
  // The common fallback now names Sun's own sprite; explicit body addresses remain pinned.
  required(expected.systemMarkers, 'Mercury system markers').url = "/navigation/body-sun@2x.webp";
  assert.deepEqual(JSON.parse(JSON.stringify(prepared)), expected);
  assert.equal(prepared.bodyMarker.size, 1.2);
  assert.equal(prepared.labels.stars.records.length, 450);
});

test("shared strip reproduces both actual Mercury WebP files and metadata exactly", async () => {
  const { plan, assets } = await prepareSolarSystemMarkerStrip({ tiles, schema: mercuryStrip.schema,
    provenance: mercuryStrip.provenance, urls: { 1: mercuryStrip.density1.url, 2: mercuryStrip.density2.url } });
  assert.equal(JSON.stringify(plan), JSON.stringify(mercuryStrip));
  for (const asset of assets) {
    assert.deepEqual(asset.bytes, await readFile(new URL(`../../public${asset.url}`, import.meta.url)));
  }
});

test("shared Sun presentation regenerates the original Mercury phase, raster, and metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "solar-system-sun-"));
  try {
    const presentation = prepareSolarSystemSunPresentation({ bodyId: "mercury", displayName: "Mercury" });
    const prepared = await preparePlanetDirectionalSun({ objectId: "mercury", publicRoot: root,
      preparedModulePath: pathToFileURL(join(root, "prepared.mjs")), ensureDirectories: () => mkdir(root, { recursive: true }),
      meanHeliocentricDistanceAu: mercurySun.distanceScaling.meanHeliocentricDistanceAu, presentation });
    const expected = structuredClone(mercurySun);
    assert.equal(expected.asset.generator, 'src/platform/prepare-directional-sun.mts');
    assert.equal(expected.provenance.sourcePath, 'src/platform/solar-geometry.mts');
    assert.equal(JSON.stringify(prepared), JSON.stringify(expected));
    for (const density of [prepared.asset.density1, prepared.asset.density2]) {
      const bytes = await readFile(join(root, required(density.url.split('/').at(-1))));
      assert.equal(bytes.length, density.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), density.sha256);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

const multiply = (matrix: readonly number[], vector: readonly number[]) => [0, 1, 2].map(row =>
  matrix[row * 3] * vector[0] + matrix[row * 3 + 1] * vector[1] + matrix[row * 3 + 2] * vector[2]);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const subtract = (a: readonly number[], b: readonly number[]): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const scale = (a: readonly number[], factor: number): Vec3 => [a[0]*factor, a[1]*factor, a[2]*factor];
const normalize = (vector: readonly number[]) => scale(vector, 1 / Math.hypot(...vector));
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
function nearVector(actual: readonly number[], expected: Vec3, tolerance: number, name: string) {
  const residual = Math.hypot(...subtract(actual, expected));
  assert.ok(residual < tolerance, `${name}: ${residual} exceeds ${tolerance}`);
}

test("Venus physical frame resolves real astronomy positions with a 6051.84km body and preserved geometry units", async () => {
  const astronomy = await loadAstronomyPackage();
  const radiusKm = astronomy.BODIES.venus.meanRadiusKm;
  assert.equal(radiusKm, 6051.84);
  assert.equal(venusScene.camera.logicalBodyDiameter / 2, 248);
  // An astrometric cube is body-independent ICRF; the same prepared sampling
  // is reusable while its scene registration must change for the observer.
  const prepared = await prepareSolarSystemScene({ bodyId: "venus", bodyRadiusUnits: 248,
    bodyRadiusKilometers: radiusKm, defaultZoom: venusScene.camera.defaultZoom,
    starfield: venusSky, sun: mercurySun, astronomy });
  const world = prepared.worldFrame;
  assert.equal(world.referenceFrame, "sun-icrf");
  assert.equal(world.epochJdTt, SOLAR_GEOMETRY_EPOCH_JD_TT);
  assert.equal(world.bodyRadiusM, 6051840);
  assert.equal(world.metersPerUnit, 6051840 / 248);
  assert.equal(prepared.camera.logicalBodyDiameter, venusScene.camera.logicalBodyDiameter);
  assert.equal(prepared.camera.defaultZoom, venusScene.camera.defaultZoom);
  assert.equal(prepared.camera.sceneScale, venusScene.camera.sceneScale);
  const epoch = world.epochJdTt;
  const venusM = scale(astronomy.systemBarycentreHeliocentricAu("venus", epoch), astronomy.M_PER_AU);
  // Checked solar geometry uses full precision VSOP87A and IAU rotations.
  // 0.001m is comfortably above its double-precision serialization residual.
  nearVector(world.originM, venusM, 0.001, "Venus origin");
  const sunIcrf = normalize(scale(venusM, -1));
  const northIcrf = astronomy.eclipticJ2000ToIcrf([0, 0, 1]);
  nearVector(world.orbitUpReference, northIcrf, 1e-12, "Orbit horizon north");
  const rightIcrf = scale(normalize(subtract(sunIcrf, scale(northIcrf, dot(sunIcrf, northIcrf)))), -1);
  const downIcrf = scale(northIcrf, -1), frontIcrf = cross(rightIcrf, downIcrf);
  for (const [axis, expected] of [[[1, 0, 0], rightIcrf], [[0, 1, 0], downIcrf], [[0, 0, 1], frontIcrf]] as const) {
    nearVector(multiply(world.presentationToReference, axis), expected, 1e-12, "Frame axis");
  }
  const sunOffsetM = scale(multiply(world.presentationToReference, prepared.heliocentricView.sun.position), world.metersPerUnit);
  nearVector(sunOffsetM, scale(venusM, -1), 0.05, "Sun relative to Venus");
  // Independently read the retained Earth-to-EMB observation. Comparing Earth
  // against VSOP87A's barycentre would reject the corrected planet centre by
  // about 4,500 km; do not reuse the generated geometry as its own oracle.
  const ephemerisRoot = new URL('../../packages/astronomy/source/scene-epoch/', import.meta.url);
  const ephemeris = JSON.parse(await readFile(new URL('manifest.json', ephemerisRoot), 'utf8'));
  const earthSource = required(array(shape({id:text,target:number,center:number,path:text,sha256:text}))(ephemeris.records).find(record => record.id === 'earth'));
  assert.equal(ephemeris.epochJdTt, epoch);
  assert.equal(earthSource.target, 399);
  assert.equal(earthSource.center, 3);
  const earthBytes = await readFile(new URL(earthSource.path, ephemerisRoot));
  assert.equal(createHash('sha256').update(earthBytes).digest('hex'), earthSource.sha256);
  const earthText = earthBytes.toString('utf8');
  assert.match(earthText, /^Target body name: Earth \(399\)/m);
  assert.match(earthText, /^Center body name: Earth-Moon Barycenter \(3\)/m);
  assert.match(earthText, /^Reference frame\s+: ICRF\s*$/m);
  assert.match(earthText, /^Output units\s+: KM-D\s*$/m);
  const earthRow = earthText.split('$$SOE')[1].split('$$EOE')[0].trim().split(',');
  assert.ok(Math.abs(Number(earthRow[0]) + ephemeris.ttMinusUtcSeconds / 86400 - epoch) < 1e-9);
  const earthOffsetKm = earthRow.slice(2, 5).map(Number);
  assert.ok(earthOffsetKm.every(Number.isFinite));
  // Haumea's retained satellite solution supplies its primary centre. The
  // analytic dwarf-planet orbit is a different solution, so read the source.
  const haumeaRoot = new URL('../../src/planets/hiiaka/source/', import.meta.url);
  const haumeaManifest = JSON.parse(await readFile(new URL('manifest.json', haumeaRoot), 'utf8'));
  const haumeaPin = required(array(shape({path:text,expectedBytes:number,expectedSha256:text}))(haumeaManifest.documents).find(entry => entry.path === 'orbit/haumea-epoch.txt'));
  const haumeaBytes = await readFile(new URL(haumeaPin.path, haumeaRoot));
  assert.equal(haumeaBytes.length, haumeaPin.expectedBytes);
  assert.equal(createHash('sha256').update(haumeaBytes).digest('hex'), haumeaPin.expectedSha256);
  const haumeaText = haumeaBytes.toString('utf8');
  assert.match(haumeaText, /^Target body name: Haumea \(primary body\) \(920136108\)/m);
  assert.match(haumeaText, /^Center body name: Sun \(10\)/m);
  assert.match(haumeaText, /^Reference frame\s+: ICRF\s*$/m);
  assert.match(haumeaText, /^Output units\s+: KM-D\s*$/m);
  const haumeaRow = haumeaText.split('$$SOE')[1].split('$$EOE')[0].trim().split(',');
  assert.ok(Math.abs(Number(haumeaRow[0]) + ephemeris.ttMinusUtcSeconds / 86400 - epoch) < 1e-9);
  const haumeaKm = haumeaRow.slice(2, 5).map(Number);
  assert.ok(haumeaKm.every(Number.isFinite));
  for (const body of required(prepared.heliocentricView.system).bodies) {
    let expectedKm = body.id === "haumea" ? haumeaKm : requireString(requireRecord(body).kind) === "dwarf-planet"
      ? astronomy.dwarfPlanetPositionKm(required(astronomy.DWARF_PLANET_IDS.find(id => id === body.id)), epoch)
      : scale(astronomy.systemBarycentreHeliocentricAu(body.id === "earth" ? "emb" : required(astronomy.PLANET_IDS.filter(id => id !== "earth").find(id => id === body.id)), epoch), astronomy.M_PER_AU / 1000);
    if (body.id === 'earth') expectedKm = expectedKm.map((value: number, axis: number) => value + earthOffsetKm[axis]);
    const offsetM = scale(multiply(world.presentationToReference, body.position), world.metersPerUnit);
    // The existing marker dataset rounds each coordinate to one scene unit;
    // its Euclidean quantization bound is half a unit along each of three axes.
    const markerToleranceM = Math.sqrt(3) * 0.5 * world.metersPerUnit + 0.05;
    nearVector(offsetM, subtract(scale(expectedKm, 1000), venusM), markerToleranceM, body.id);
    assert.equal(requireFiniteNumber(requireRecord(body).radiusKilometers), astronomy.BODIES[required(astronomy.BODY_IDS.find(id => id === body.id))].meanRadiusKm);
  }
  const presentation = prepareSolarSystemPresentation({ ...presentationConfig,
    bodyId: "venus", plan: prepared.heliocentricView });
  assert.equal(presentation.bodyMarker.index, PREPARED_NAVIGATION_MARKERS.venus.index);
  assert.ok(presentation.systemMarkers.bodies.mercury);
  assert.equal(presentation.systemMarkers.bodies.venus, undefined);
  assert.notEqual(prepared.starfield.sceneRegistration, mercuryPrepared.starfield.sceneRegistration);
  assert.equal(prepared.heliocentricView.runtimeGeometryDerivation, false);
});

test("Venus prepared leaf vertices render at the physical radius independently of framing zoom", () => {
  const physicalRadius = venusScene.heliocentricView.units.bodyRadiusUnits;
  assert.equal(venusScene.camera.defaultZoom, 1.9);
  assert.equal(venusScene.camera.sceneScale, 0.02);
  let vertexCount = 0;
  for (const leaf of venusScene.body.leaves.filter(leaf => leaf.polarCap === null)) {
    const matrix = required(leaf.style.match(/matrix3d\(([^)]+)\)/u))[1].split(",").map(Number);
    const width = Number(required(leaf.style.match(/--polycss-atlas-width:([\d.]+)px/u))[1]);
    const height = Number(required(leaf.style.match(/--polycss-atlas-height:([\d.]+)px/u))[1]);
    for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
      const w = matrix[3] * x + matrix[7] * y + matrix[15];
      const vertex = [0, 1, 2].map(axis =>
        (matrix[axis] * x + matrix[axis + 4] * y + matrix[axis + 12]) / w);
      const renderedRadius: number = Math.hypot(...vertex) * venusScene.camera.sceneScale;
      // Six-decimal projective matrix coefficients amplify at the near pole;
      // 0.01 scene unit bounds their measured 0.00827-unit rounding residual.
      assert.ok(Math.abs(renderedRadius - physicalRadius) < 0.01,
        `Prepared vertex radius ${renderedRadius} disagrees with physical radius ${physicalRadius}`);
      vertexCount++;
    }
  }
  assert.equal(vertexCount, 1792);
});

test("Mercury geometry and material use the same physical radius without framing enlargement", async () => {
  assert.equal(mercuryScene.camera.sceneScale, 1 / 50);
  assert.equal(mercuryScene.heliocentricView.units.bodyRadiusUnits, 230);
  const fit = mercuryPresentation.viewBindings.find(binding => binding.kind === "silhouette-fit");
  // The shared TypeScript compiler has independent frozen-output parity tests.
  const authoredMaterialRadius = mercuryAssets.lighting.presentationFrameSize / 2;
  assert.equal(authoredMaterialRadius, 230);
  for (const projectedRadius of [0.2, 0.6, 2, 20, 230, 400]) {
    const displayedRadius = Math.max(required(required(fit).minimumRadius), projectedRadius);
    assert.ok(Math.abs(authoredMaterialRadius * required(required(fit).unitScale) * displayedRadius - displayedRadius) < 1e-10,
      "Prepared material must cover precisely the physical silhouette, with only the visibility floor");
  }
  let vertices = 0;
  for (const leaf of mercuryScene.bodyLeaves.filter(leaf => !leaf.polar)) {
    const matrix = required(leaf.style.match(/matrix3d\(([^)]+)\)/u))[1].split(",").map(Number);
    const width = Number(required(leaf.style.match(/--polycss-atlas-width:([\d.]+)px/u))[1]);
    const height = Number(required(leaf.style.match(/--polycss-atlas-height:([\d.]+)px/u))[1]);
    for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
      const w = matrix[3] * x + matrix[7] * y + matrix[15];
      const point = [0, 1, 2].map(axis =>
        (matrix[axis] * x + matrix[axis + 4] * y + matrix[axis + 12]) / w);
      assert.ok(Math.abs(Math.hypot(...point) * mercuryScene.camera.sceneScale - 230) < 0.01);
      vertices++;
    }
  }
  assert.equal(vertices, 1792);
});

test("incompatible sky, missing physical scale, marker, and phase inputs fail at preparation", async () => {
  await assert.rejects(Reflect.apply(prepareSolarSystemScene, undefined, [{ ...mercuryConfig, starfield: { ...mercurySky, astrometricRegistration: undefined } }]), /astrometric/u);
  await assert.rejects(Reflect.apply(prepareSolarSystemScene, undefined, [{ ...mercuryConfig, bodyRadiusKilometers: 0 }]), /invalid/u);
  assert.throws(() => Reflect.apply(prepareSolarSystemCamera, undefined, [{ bodyRadiusUnits: 0 }]), /Physical camera/u);
  // The shared atlas now supplies every registered body. Exercise a missing
  // marker by withholding both its shared entry and its legacy strip fallback.
  const navigationMarkers = { ...PREPARED_NAVIGATION_MARKERS };
  Reflect.deleteProperty(navigationMarkers, "ceres");
  assert.ok(prepareSolarSystemPresentation({ ...presentationConfig, navigationMarkers }).systemMarkers.bodies.ceres);
  assert.throws(() => Reflect.apply(prepareSolarSystemPresentation, undefined, [{ ...presentationConfig, navigationMarkers, systemMarkerStrip: null }]), /No prepared marker/u);
  assert.throws(() => Reflect.apply(prepareSolarSystemPresentation, undefined, [{ ...presentationConfig, phaseAtlas: null }]), /phase atlas/u);
  assert.throws(() => Reflect.apply(prepareSolarSystemPresentation, undefined, [{ ...presentationConfig, captionNames: {} }]), /caption/u);
});
