import { requireRecord, requireString } from '../sources/source-values.mts';
import { requireObjectRuntimeDefinition } from '../contract/object-runtime-contract.mts';
import { shape, text } from './terrestrial-layers/source-records.mts';
import { required } from '../contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prepareSolarSystemCamera, prepareSolarSystemScene } from "./solar-system-scene.mts";
import { readJsonSource } from '../sources/source-values.mts';
import { loadAstronomyPackage } from "../../src/platform/astronomy-package.mts";
import { SOLAR_GEOMETRY_EPOCH_JD_TT } from "../../src/platform/solar-geometry.mts";
import type { Vec3 } from "@cssearth/astronomy";

// The prepared fixtures are generated, ignored files: read them at run time so
// the typecheck does not depend on a prepared checkout. Their shapes are the
// producers' own return and parameter types, checked further by the comparisons below.
type SceneConfig = Parameters<typeof prepareSolarSystemScene>[0];
type PreparedScene = Awaited<ReturnType<typeof prepareSolarSystemScene>> & { body: { leaves: { style: string; polarCap: string | null }[] }; bodyLeaves: { style: string; polar?: unknown }[] };
type PreparedAssets = { lighting: { presentationFrameSize: number } };
const prepared = async <T,>(id: string, file: string) => requireRecord(await readJsonSource(new URL(`../../src/objects/${id}/prepared/${file}`, import.meta.url))) as T;
const [mercuryScene, mercurySky, mercuryAssets, venusScene, venusSky] = await Promise.all([
  prepared<PreparedScene>('mercury', 'scene.json'), prepared<SceneConfig['starfield']>('mercury', 'sky.json'),
  prepared<PreparedAssets>('mercury', 'assets.json'),
  prepared<PreparedScene>('venus', 'scene.json'), prepared<SceneConfig['starfield']>('venus', 'sky.json')]);
const mercuryRuntime = requireRecord(await readJsonSource(new URL('../../src/objects/mercury/prepared/runtime.json', import.meta.url)));
const mercuryPresentation = requireObjectRuntimeDefinition(mercuryRuntime);

const mercuryConfig: SceneConfig = { bodyId: "mercury", bodyRadiusUnits: 230, bodyRadiusKilometers: 2439.7,
  defaultZoom: 1.1, geometryScale: 1, starfield: mercurySky };
const mercuryPrepared = await prepareSolarSystemScene(mercuryConfig);

test("Mercury retained leaf mapping stays source-bound and the runtime carries no private sky or Sun", () => {
  const presentation = structuredClone(mercuryPresentation);
  assertPreparedProjectiveMappings(presentation, mercuryScene);
  assert.equal(Object.hasOwn(mercuryRuntime, 'heliocentricView'), false, 'the shared universe draws the solar system');
  assert.ok(presentation.assets.startup.every(key => !key.startsWith("sky:") && !key.startsWith("interior:") && !key.includes("directional-sun")));
  assert.ok(presentation.variants.filter(v => v.when.lensId === "interior").every(v => v.required.includes("interior:section")));
  // The world-navigation stage replaces the interim presentation map with the body as drawn; everything else is this preparation's.
  const { presentationToReference: drawn, ...retained } = mercuryScene.worldFrame, { presentationToReference: interim, ...prepared } = mercuryPrepared.worldFrame;
  assert.deepEqual(retained, prepared);
  for (const matrix of [drawn, interim]) assert.ok(Math.abs(determinant(matrix) + 1) < 1e-12, 'a map into CSS 3D space reverses handedness');
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
    const directMatrix = required(/^matrix3d\(([^)]+)\)/u.exec(transform.value)?.[1], 'Prepared matrix precedes the independent seam outset');
    const direct = matrix(directMatrix), frame = matrix(layer.frameMatrix), texture = matrix(layer.textureMatrix);
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
    const descriptor = JSON.parse(await readFile(new URL(`../../src/objects/${id}/object.json`, import.meta.url), "utf8"));
    assert.deepEqual(descriptor.properties.worldFrame, scene.worldFrame);
    assert.ok((await readFile(new URL(`../../src/objects/${id}/${descriptor.prepared.url}`, import.meta.url))).length > 0);
  }
});

test("shared physical scene reproduces every existing Mercury subplan byte for byte", () => {
  for (const key of ["camera", "systemTransform", "presentationFrame", "starfield"] as const) {
    assert.equal(JSON.stringify(mercuryPrepared[key]), JSON.stringify(mercuryScene[key]), key);
  }
});

const multiply = (matrix: readonly number[], vector: readonly number[]) => [0, 1, 2].map(row =>
  matrix[row * 3] * vector[0] + matrix[row * 3 + 1] * vector[1] + matrix[row * 3 + 2] * vector[2]);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const subtract = (a: readonly number[], b: readonly number[]): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const scale = (a: readonly number[], factor: number): Vec3 => [a[0]*factor, a[1]*factor, a[2]*factor];
const normalize = (vector: readonly number[]) => scale(vector, 1 / Math.hypot(...vector));
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
function determinant(m: readonly number[]) {
  return m[0]! * (m[4]! * m[8]! - m[5]! * m[7]!) - m[1]! * (m[3]! * m[8]! - m[5]! * m[6]!) + m[2]! * (m[3]! * m[7]! - m[4]! * m[6]!);
}
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
    bodyRadiusKilometers: radiusKm, defaultZoom: venusScene.camera.defaultZoom, starfield: venusSky });
  const world = prepared.worldFrame;
  assert.equal(world.referenceFrame, "sun-icrf");
  assert.equal(world.epochJdTt, SOLAR_GEOMETRY_EPOCH_JD_TT);
  assert.equal(world.bodyRadiusM, 6051840);
  assert.equal(world.metersPerUnit, 6051840 / 248);
  assert.equal(prepared.camera.logicalBodyDiameter, venusScene.camera.logicalBodyDiameter);
  assert.equal(prepared.camera.defaultZoom, venusScene.camera.defaultZoom);
  assert.equal(prepared.camera.sceneScale, venusScene.camera.sceneScale);
  const venusM = scale(astronomy.systemBarycentreHeliocentricAu("venus", world.epochJdTt), astronomy.M_PER_AU);
  // Checked solar geometry uses full precision VSOP87A and IAU rotations.
  // 0.001m is comfortably above its double-precision serialization residual.
  nearVector(world.originM, venusM, 0.001, "Venus origin");
  const sunIcrf = normalize(scale(venusM, -1));
  const northIcrf = astronomy.eclipticJ2000ToIcrf([0, 0, 1]);
  nearVector(world.orbitUpReference, northIcrf, 1e-12, "Orbit horizon north");
  // The presentation map is interim here (the world-navigation stage derives it from the body as drawn), but it is always a reflection.
  assert.ok(Math.abs(determinant(world.presentationToReference) + 1) < 1e-12, 'a map into CSS 3D space reverses handedness');
  assert.notEqual(prepared.starfield.sceneRegistration, mercuryPrepared.starfield.sceneRegistration);
});

test("Venus prepared leaf vertices render at the physical radius independently of framing zoom", () => {
  const physicalRadius = venusScene.camera.logicalBodyDiameter / 2;
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
  assert.equal(mercuryScene.camera.logicalBodyDiameter / 2, 230);
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

test("a sky without its projection and an invalid physical camera fail at preparation", async () => {
  await assert.rejects(Reflect.apply(prepareSolarSystemScene, undefined, [{ ...mercuryConfig, starfield: { ...mercurySky, projection: undefined } }]), /projection/u);
  assert.throws(() => Reflect.apply(prepareSolarSystemCamera, undefined, [{ bodyRadiusUnits: 0 }]), /Physical camera/u);
});
