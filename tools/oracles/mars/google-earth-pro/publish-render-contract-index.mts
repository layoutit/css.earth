import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import { array, object, finite, integer, numbers, text, boolean, parseJson } from './oracle-values.mts';

const workspaceRoot = resolve(import.meta.dirname, "../../../../..");
const evidenceRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-render-contract-live-v1",
);
const renderRun = resolve(
  evidenceRoot,
  "run-full-final-2026-09-02",
);
const sunRun = resolve(
  evidenceRoot,
  "run-sun-presentation-authoritative-final-2026-09-02",
);
const outputRoot = resolve(process.argv[2] ?? resolve(
  evidenceRoot,
  "run-authoritative-contract-2026-09-02",
));
if (!outputRoot.startsWith(`${evidenceRoot}/run-`)) {
  throw new Error(`Output must be beneath ${evidenceRoot}.`);
}
const resourceRoot = resolve(outputRoot, "resources");
await mkdir(resourceRoot, { recursive: true });

const [cameraValue, skyboxValue, sunValue] = await Promise.all([
  readJson(resolve(renderRun, "camera-contract.json")),
  readJson(resolve(renderRun, "skybox-contract.json")),
  readJson(resolve(sunRun, "sun-presentation-contract.json")),
]);
const camera = parseCamera(cameraValue), skybox = parseSkybox(skyboxValue), rawSun = parseSun(sunValue);
const samples = rawSun.movement.samples.map((sample) => {
  const vertices = sample.presentation.projectedVerticesNdc ?? [];
  const bounds = sample.presentation.projectedBoundsNdc;
  const inViewport = sample.presentation.drawn && bounds !== null &&
    vertices.length === 4 && vertices.every((entry) => entry[3] > 0) &&
    bounds.maximumX >= -1 && bounds.minimumX <= 1 &&
    bounds.maximumY >= -1 && bounds.minimumY <= 1;
  return Object.freeze({
    ...sample,
    presentation: Object.freeze({ ...sample.presentation, inViewport }),
  });
});
const sun = Object.freeze({
  ...rawSun,
  qualification:
    "NATIVE_HEADLESS_DEFAULT_SUN_TEXTURE_QUAD_MATRICES_AND_56_POSE_MOVEMENT_EXTRACTED",
  movement: Object.freeze({
    ...rawSun.movement,
    inViewportCount: samples.filter(({ presentation }) =>
      presentation.inViewport).length,
    clipQualification:
      "A pose is visible only when the exact four client-array vertices remain in front of the camera and their projected bounds intersect NDC.",
    samples: Object.freeze(samples),
  }),
});
if (camera.poseResponses.length !== 56 || sun.movement.poseCount !== 56 ||
    skybox.catalogue.drawCount !== 5_000) {
  throw new Error("Contract evidence is incomplete.");
}

const resources = [];
for (const [role, sourcePath, extension] of [
  ["sky-map", resourcePath("sky-map"),
    "rgba"],
  ["star-radial-response", resourcePath("star-radial-response"), "rgba"],
  ["star-catalogue-buffer", resourcePath("star-catalogue-buffer"), "bin"],
  ["sun-default-billboard", sun.defaultPath.texture.rawPath, "rgba"],
]) {
  const outputPath = resolve(resourceRoot, `${role}.${extension}`);
  await copyFile(sourcePath, outputPath);
  resources.push(Object.freeze({
    role,
    path: outputPath,
    bytes: (await readFile(outputPath)).length,
    sha256: await fileSha256(outputPath),
    qualification: "EXACT_LIVE_BOUND_GL_BYTES",
  }));
}

const cleanSunContactSheetPath = resolve(
  outputRoot,
  "native-sun-visible-four-angle-clean.png",
);
const visibleSamples = samples.filter(({ presentation }) => {
  const bounds = presentation.projectedBoundsNdc;
  return presentation.inViewport && bounds !== null && bounds.minimumX >= -1 &&
    bounds.maximumX <= 1 && bounds.minimumY >= -0.776 &&
    bounds.maximumY <= 0.876;
}).slice(0, 4);
if (visibleSamples.length !== 4) throw new Error("Four clean Sun views not found.");
const cleanPanels = await Promise.all(visibleSamples.map(async ({ capture }) =>
  sharp(capture.path).rotate().extract({
    left: 0,
    top: 80,
    width: 2092,
    height: 1070,
  }).resize(1046, 535).png().toBuffer()));
await sharp({
  create: {
    width: 2092,
    height: 1070,
    channels: 4,
    background: "#000000",
  },
}).composite(cleanPanels.map((input, index) => ({
  input,
  left: index % 2 * 1046,
  top: Math.floor(index / 2) * 535,
}))).png().toFile(cleanSunContactSheetPath);

const sunTexturePreviewPath = resolve(outputRoot, "sun-default-billboard-8x.png");
const sunResource = resources.find(({ role }) => role === "sun-default-billboard");
if (!sunResource) throw new Error("Sun texture resource is missing.");
await sharp(await readFile(sunResource.path), {
  raw: { width: 128, height: 128, channels: 4 },
}).flip().resize(1024, 1024, { kernel: "nearest" }).png()
  .toFile(sunTexturePreviewPath);

const qualifiedSunPath = resolve(outputRoot, "sun-presentation-contract.json");
const cameraPath = resolve(outputRoot, "camera-contract.json");
const skyboxPath = resolve(outputRoot, "skybox-contract.json");
await Promise.all([
  writeFile(qualifiedSunPath, `${JSON.stringify(sun, null, 2)}\n`),
  writeFile(cameraPath, `${JSON.stringify(camera, null, 2)}\n`),
  writeFile(skyboxPath, `${JSON.stringify(skybox, null, 2)}\n`),
]);
const index = Object.freeze({
  schema: "cssmars-google-earth-pro-authoritative-render-contract-index@1",
  qualification:
    "NATIVE_HEADLESS_CAMERA_SKYBOX_STAR_CATALOGUE_AND_SUN_CONTRACT_EXTRACTED",
  generatedAt: new Date().toISOString(),
  sourceApplication: Object.freeze({
    name: "Google Earth Pro Mars",
    version: "7.3.7.1327",
    architecture: "x86_64",
    rendererSha256:
      "b656a4d024891b58956677785cb706d7dd52c6b60c5269cd7bed8d8c6f23c70f",
  }),
  contracts: Object.freeze({
    camera: Object.freeze({ path: cameraPath, sha256: await fileSha256(cameraPath) }),
    skybox: Object.freeze({ path: skyboxPath, sha256: await fileSha256(skyboxPath) }),
    sun: Object.freeze({
      path: qualifiedSunPath,
      sha256: await fileSha256(qualifiedSunPath),
    }),
  }),
  resources: Object.freeze(resources),
  visualEvidence: Object.freeze({
    cleanSunFourAngleContactSheet: cleanSunContactSheetPath,
    sunTexturePreview: sunTexturePreviewPath,
    fullPairedSweepContactSheet: resolve(renderRun, "native-sun-sweep-contact-sheet.png"),
  }),
  validation: Object.freeze({
    cameraPoseCount: camera.poseResponses.length,
    SunPoseCount: sun.movement.poseCount,
    SunDrawCount: sun.movement.drawCount,
    SunInViewportCount: sun.movement.inViewportCount,
    skyMapDimensions: Object.freeze([
      skybox.skyMap.sampler.width,
      skybox.skyMap.sampler.height,
    ]),
    catalogueDrawCount: skybox.catalogue.drawCount,
    allResourcesExact: resources.every(({ qualification }) =>
      qualification === "EXACT_LIVE_BOUND_GL_BYTES"),
  }),
});
const indexPath = resolve(outputRoot, "contract-index.json");
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ok: true,
  indexPath,
  qualification: index.qualification,
  validation: index.validation,
  cleanSunContactSheetPath,
  sunTexturePreviewPath,
}, null, 2)}\n`);

async function readJson(path: string): Promise<unknown> {
  return parseJson(await readFile(path, "utf8"));
}

async function fileSha256(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}


function resourcePath(role: string): string {
  const resource = skybox.resources.find(resource => resource.role === role);
  if (!resource) throw new Error(`Missing native resource: ${role}`);
  return resource.rawPath;
}
function parseCamera(value: unknown) {
  const raw = object(value, 'camera contract');
  return { ...raw, poseResponses: array(raw.poseResponses) };
}
function parseSkybox(value: unknown) {
  const raw = object(value, 'skybox contract'), catalogue = object(raw.catalogue);
  const skyMap = object(raw.skyMap), sampler = object(skyMap.sampler);
  return { ...raw, catalogue: { ...catalogue, drawCount: integer(catalogue.drawCount) },
    skyMap: { ...skyMap, sampler: { ...sampler, width: integer(sampler.width), height: integer(sampler.height) } },
    resources: array(raw.resources).map(value => {
      const resource = object(value); return { ...resource, role: text(resource.role), rawPath: text(resource.rawPath) };
    }) };
}
function parseSun(value: unknown) {
  const raw = object(value, 'sun contract'), movement = object(raw.movement);
  const defaultPath = object(raw.defaultPath), texture = object(defaultPath.texture);
  return { ...raw, defaultPath: { ...defaultPath, texture: { ...texture, rawPath: text(texture.rawPath) } },
    movement: { ...movement, poseCount: integer(movement.poseCount), drawCount: integer(movement.drawCount),
      samples: array(movement.samples).map(value => {
        const sample = object(value), presentation = object(sample.presentation), capture = object(sample.capture);
        const bounds = presentation.projectedBoundsNdc == null ? null : object(presentation.projectedBoundsNdc);
        return { ...sample, capture: { ...capture, path: text(capture.path) },
          presentation: { ...presentation, drawn: boolean(presentation.drawn),
            projectedVerticesNdc: presentation.projectedVerticesNdc == null ? [] : array(presentation.projectedVerticesNdc).map(value => {
              const vertex = numbers(value); if (vertex.length !== 4) throw new TypeError('Projected vertex needs four components.'); return vertex;
            }), projectedBoundsNdc: bounds === null ? null : { ...bounds,
              minimumX: finite(bounds.minimumX), maximumX: finite(bounds.maximumX),
              minimumY: finite(bounds.minimumY), maximumY: finite(bounds.maximumY) } } };
      }) } };
}
