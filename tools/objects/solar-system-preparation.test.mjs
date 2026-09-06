import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareSolarSystemCamera, prepareSolarSystemScene, prepareSolarSystemSunPresentation } from "./solar-system-scene.mjs";
import { prepareSolarSystemPresentation } from "./solar-system-presentation.mjs";
import { prepareSolarSystemMarkerStrip } from "./solar-system-markers.mjs";
import mercuryScene from "../../objects/preparation/mercury/scene.json" with {type: "json"};
import mercurySky from "../../objects/preparation/mercury/sky.json" with {type: "json"};
import mercurySun from "../../objects/preparation/mercury/sun.json" with {type: "json"};
import mercuryAssets from "../../objects/preparation/mercury/assets.json" with {type: "json"};
import mercuryStrip from "../../objects/preparation/mercury/markers.json" with {type: "json"};
import mercuryPresentation from "../../objects/preparation/mercury/runtime.json" with {type: "json"};
import venusScene from "../../objects/preparation/venus/scene.json" with {type: "json"};
import venusSky from "../../objects/preparation/venus/sky.json" with {type: "json"};
import { PREPARED_NAVIGATION_MARKERS } from "../../site/prepared-navigation-markers.mjs";
import { prepareCatalogueStars } from "../../src/platform/prepare-catalogue-stars.mjs";
import { preparePlanetDirectionalSun } from "../../src/platform/prepare-directional-sun.mjs";
import { loadAstronomyPackage } from "../../src/platform/astronomy-package.mjs";
import { SOLAR_GEOMETRY_EPOCH_JD_TT } from "../../src/platform/solar-geometry.mjs";

const mercuryConfig = { bodyId: "mercury", bodyRadiusUnits: 230, bodyRadiusKilometers: 2439.7,
  defaultZoom: 1.1, geometryScale: 1, starfield: mercurySky, sun: mercurySun };
const mercuryPrepared = await prepareSolarSystemScene(mercuryConfig);
const catalogue = await prepareCatalogueStars({ fovDegrees: 60 });
const phaseAtlas = { ...mercuryAssets.lighting.banks["2"].billboard,
  minimumLightViewZ: mercuryAssets.lighting.minimumLightViewZ,
  maximumLightViewZ: mercuryAssets.lighting.maximumLightViewZ,
  baseLightAzimuthDegrees: mercuryAssets.lighting.baseLightAzimuthDegrees };
const presentationConfig = { bodyId: "mercury", plan: mercuryPrepared.heliocentricView,
  navigationMarkers: PREPARED_NAVIGATION_MARKERS, markerAtlasUrl: "/navigation/planet-markers@2x.webp",
  systemMarkerStrip: mercuryStrip, phaseAtlas, captionNames: mercuryPresentation.heliocentricView.labels.names, catalogue };
const tiles = [
  { id: "ceres", color: [110, 106, 102], size: 5 },
  { id: "eris", color: [232, 230, 226], size: 6 },
  { id: "haumea", color: [217, 216, 212], size: 5 },
  { id: "makemake", color: [185, 138, 106], size: 5 },
];

test("Mercury preserves all baseline bytes except physical geometry and overlay scale corrections", () => {
  const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const { worldFrame, ...scene } = structuredClone(mercuryScene);
  const {id, controls, ...presentation} = structuredClone(mercuryPresentation);
  presentation.schema = "cssearth-prepared-presentation@3";
  const oldTransform = "scale(0.022000000000000002) rotateX(40deg) rotate(0deg) translate3d(0px, 0px, 0px)";
  // Only these three authored fields changed. Restore their historical values
  // for byte parity, then independently prove their corrected physical extent.
  scene.camera.sceneScale = 1.1 / 50;
  scene.camera.defaultTransform = oldTransform;
  presentation.camera = scene.camera;
  presentation.tree.properties.find(property => property.value === mercuryScene.camera.defaultTransform).value = oldTransform;
  presentation.viewBindings.find(binding => binding.kind === "silhouette-fit").unitScale = 2 * 1.1 / 460;
  assert.equal(hash(scene), "fd07cb83678d7efd46023c7d997ec2c368d3c293d4a2ee6553711111285129e3");
  assert.equal(hash(presentation), "491ab38e7ad386ce4db088844c5b05901a8a0c62c445b81a3dc701b0afbdab13");
  assert.deepEqual(worldFrame, mercuryPrepared.worldFrame);
});

test("registered descriptors publish the generated physical frames and exact payload identities", async () => {
  for (const [id, scene] of [["mercury", mercuryScene], ["venus", venusScene]]) {
    const descriptor = JSON.parse(await readFile(new URL(`../../src/planets/${id}/object.json`, import.meta.url), "utf8"));
    assert.deepEqual(descriptor.properties.worldFrame, scene.worldFrame);
    const payload = await readFile(new URL(`../../objects/${descriptor.prepared.url}`, import.meta.url));
    assert.equal(createHash("sha256").update(payload).digest("hex"), descriptor.prepared.sha256);
  }
});

test("shared physical scene reproduces every existing Mercury subplan byte for byte", () => {
  for (const key of ["camera", "systemTransform", "presentationFrame", "heliocentricView", "starfield"]) {
    assert.equal(JSON.stringify(mercuryPrepared[key]), JSON.stringify(mercuryScene[key]), key);
  }
});

test("shared marker, phase, and catalogue assembly reproduces Mercury bytes", () => {
  const prepared = prepareSolarSystemPresentation(presentationConfig);
  assert.equal(JSON.stringify(prepared), JSON.stringify(mercuryPresentation.heliocentricView));
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
    assert.equal(JSON.stringify(prepared), JSON.stringify(mercurySun));
  } finally { await rm(root, { recursive: true, force: true }); }
});

const multiply = (matrix, vector) => [0, 1, 2].map(row =>
  matrix[row * 3] * vector[0] + matrix[row * 3 + 1] * vector[1] + matrix[row * 3 + 2] * vector[2]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const scale = (a, factor) => a.map(value => value * factor);
const normalize = vector => scale(vector, 1 / Math.hypot(...vector));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function nearVector(actual, expected, tolerance, name) {
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
  for (const [axis, expected] of [[[1, 0, 0], rightIcrf], [[0, 1, 0], downIcrf], [[0, 0, 1], frontIcrf]]) {
    nearVector(multiply(world.presentationToReference, axis), expected, 1e-12, "Frame axis");
  }
  const sunOffsetM = scale(multiply(world.presentationToReference, prepared.heliocentricView.sun.position), world.metersPerUnit);
  nearVector(sunOffsetM, scale(venusM, -1), 0.05, "Sun relative to Venus");
  for (const body of prepared.heliocentricView.system.bodies) {
    const expectedKm = body.kind === "dwarf-planet"
      ? astronomy.dwarfPlanetPositionKm(body.id, epoch)
      : scale(astronomy.systemBarycentreHeliocentricAu(body.id === "earth" ? "emb" : body.id, epoch), astronomy.M_PER_AU / 1000);
    const offsetM = scale(multiply(world.presentationToReference, body.position), world.metersPerUnit);
    // The existing marker dataset rounds each coordinate to one scene unit;
    // its Euclidean quantization bound is half a unit along each of three axes.
    const markerToleranceM = Math.sqrt(3) * 0.5 * world.metersPerUnit + 0.05;
    nearVector(offsetM, subtract(scale(expectedKm, 1000), venusM), markerToleranceM, body.id);
    assert.equal(body.radiusKilometers, astronomy.BODIES[body.id].meanRadiusKm);
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
    const matrix = leaf.style.match(/matrix3d\(([^)]+)\)/u)[1].split(",").map(Number);
    const width = Number(leaf.style.match(/--polycss-atlas-width:([\d.]+)px/u)[1]);
    const height = Number(leaf.style.match(/--polycss-atlas-height:([\d.]+)px/u)[1]);
    for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
      const w = matrix[3] * x + matrix[7] * y + matrix[15];
      const vertex = [0, 1, 2].map(axis =>
        (matrix[axis] * x + matrix[axis + 4] * y + matrix[axis + 12]) / w);
      const renderedRadius = Math.hypot(...vertex) * venusScene.camera.sceneScale;
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
    const displayedRadius = Math.max(fit.minimumRadius, projectedRadius);
    assert.ok(Math.abs(authoredMaterialRadius * fit.unitScale * displayedRadius - displayedRadius) < 1e-10,
      "Prepared material must cover precisely the physical silhouette, with only the visibility floor");
  }
  let vertices = 0;
  for (const leaf of mercuryScene.bodyLeaves.filter(leaf => !leaf.polar)) {
    const matrix = leaf.style.match(/matrix3d\(([^)]+)\)/u)[1].split(",").map(Number);
    const width = Number(leaf.style.match(/--polycss-atlas-width:([\d.]+)px/u)[1]);
    const height = Number(leaf.style.match(/--polycss-atlas-height:([\d.]+)px/u)[1]);
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
  await assert.rejects(prepareSolarSystemScene({ ...mercuryConfig, starfield: { ...mercurySky, astrometricRegistration: undefined } }), /astrometric/u);
  await assert.rejects(prepareSolarSystemScene({ ...mercuryConfig, bodyRadiusKilometers: 0 }), /invalid/u);
  assert.throws(() => prepareSolarSystemCamera({ bodyRadiusUnits: 0 }), /Physical camera/u);
  assert.throws(() => prepareSolarSystemPresentation({ ...presentationConfig, systemMarkerStrip: null }), /No prepared marker/u);
  assert.throws(() => prepareSolarSystemPresentation({ ...presentationConfig, phaseAtlas: null }), /phase atlas/u);
  assert.throws(() => prepareSolarSystemPresentation({ ...presentationConfig, captionNames: {} }), /caption/u);
});
