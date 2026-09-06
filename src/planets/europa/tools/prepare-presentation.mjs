import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { prepareRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { PREPARED_NAVIGATION_MARKERS } from "../../../../site/prepared-navigation-markers.mjs";
import { DEFAULT_LABEL_POLICY } from "../../../platform/label-field.mjs";
import { STAR_LABEL_POLICY } from "../../../platform/star-labels.mjs";
import { prepareCatalogueStars } from "../../../platform/prepare-catalogue-stars.mjs";
import { loadAstronomyPackage } from "../../../platform/astronomy-package.mjs";
import { EUROPA_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { objectControls } from "../site/control-content.mjs";

const plan = JSON.parse(await readFile(new URL("../.prepared/scene.json", import.meta.url)));
const { surfaces, lighting } = JSON.parse(await readFile(new URL("../.prepared/material.json", import.meta.url)));
const parentMarker = JSON.parse(await readFile(new URL("../.prepared/parent-marker.json", import.meta.url)));
const pointUrl = "/scenes/europa/europa-system-point.webp";
const point = Buffer.alloc(32 * 32 * 4);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (Math.hypot(x - 15.5, y - 15.5) <= 15.5) {
  const offset = (y * 32 + x) * 4;
  point.set([180, 180, 180, 255], offset);
}
await sharp(point, { raw: { width: 32, height: 32, channels: 4 } }).webp({ lossless: true })
  .toFile(new URL("../../../../public/scenes/europa/europa-system-point.webp", import.meta.url).pathname);
const entries = [
  ...preparedSkyResources(plan.sky, plan.sun, "mounted"),
  { key: "lighting", url: lighting.url, pool: "mounted" },
  { key: "system-point", url: pointUrl, pool: "mounted" },
  { key: "parent-marker", url: parentMarker.url, pool: "mounted" },
  ...surfaces.flatMap(s => [
    { key: `surface:${s.id}`, url: s.surface.url, pool: s.id === "normal" ? "mounted" : "lenses" },
    { key: `poles:${s.id}`, url: s.polesUrl, pool: s.id === "normal" ? "mounted" : "lenses" },
  ]),
];
const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.bodyLeaves.map(leaf => leaf.style)) });
const camera = b.mesh("polycss-camera europa-camera planet-render-root");
const scene = b.mesh("polycss-scene europa-scene"), system = b.mesh("europa-system", `transform:${plan.systemTransform}`);
const body = b.mesh("europa-body");
b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
for (const leaf of plan.bodyLeaves) b.append(body, b.leaf(leaf));
const materialRoot = b.element("div", "europa-material-root planet-render-root");
const billboard = b.element("s", "europa-billboard"), material = b.element("s", "europa-material");
b.append(null, materialRoot); b.append(materialRoot, billboard); b.append(materialRoot, material);
const { tree, index } = b.finish({ camera, scene });
const track = { id: "lighting", target: index(material),
  frame: { source: "sun-z", minimum: -1, maximum: 1, count: lighting.frameCount, baseFrame: 0, remap: null },
  banks: [{ id: "atlas", frames: lighting.frames, default: null, fixed: lighting.frames.at(-1),
    rows: [{ row: 0, resource: "lighting", firstFrame: 0, lastFrame: lighting.frameCount - 1 }] }],
  demand: { capacity: 1, defaultFrame: Math.floor(lighting.frameCount / 2) },
  rotation: { kind: "angle", source: "view-sun", reference: "prepared", baseDegrees: 0,
    zeroAtPole: false, property: "--europa-light-roll" }, frameAttribute: null, modeAttribute: null, quoted: true };
const variants = surfaces.flatMap(s => [false, true].flatMap(shadows => [false, true].map(orbit => ({
  when: { lensId: s.id, shadows, orbit }, required: [`surface:${s.id}`, `poles:${s.id}`, "lighting"],
  writes: [
    { kind: "texture", target: index(body), name: "--europa-surface-image", resource: `surface:${s.id}`, quoted: true },
    { kind: "texture", target: index(body), name: "--europa-poles-image", resource: `poles:${s.id}`, quoted: true },
    { kind: "style", target: index(materialRoot), name: "--europa-billboard-color", value: s.billboardColor },
    { kind: "attribute", target: -1, name: "data-lens", value: s.id },
    { kind: "class", target: -1, name: "europa-hide-orbit", value: !orbit },
  ],
  // Color observations already contain illumination from their acquisition dates.
  // Applying a second Sun or full-phase falloff cannot relight those photographs.
  materials: [{ track: "lighting", bank: "atlas", mode: shadows ? "frames" : "fixed", enabled: s.relight !== false,
    rotationEnabled: shadows && s.relight !== false, frameOverride: null, clearWhenHidden: true, fixedMode: "full-phase-curvature" }],
}))));
const atlasUrl = "/navigation/planet-markers@2x.webp";
const sprite = id => {
  if (id === parentMarker.id) return {url:parentMarker.url,index:0,count:1,size:parentMarker.size};
  const marker = PREPARED_NAVIGATION_MARKERS[id];
  return marker ? { index: marker.index, count: marker.count, size: marker.presentation.size }
    : { url: pointUrl, index: 0, count: 1, size: 5 };
};
const { BODIES } = await loadAstronomyPackage();
const catalogue = await prepareCatalogueStars({ fovDegrees: plan.sky.catalogueStars.exposure.fovDegrees });
const presentation = { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.sky, sun: plan.sun,
  assets: { entries, pools: [preparedResourcePool("mounted", entries),
    // Keep the committed surface/poles while decoding the next lens's pair.
    preparedResourcePool("lenses", entries, { retention: "selection", capacity: 4, concurrency: 2 })],
    startup: entries.filter(entry => entry.pool === "mounted").map(entry => entry.key) },
  tree, variants, materials: [track], animations: [],
  heliocentricView: { plan: plan.heliocentricView,
    bodyMarker: { url: atlasUrl, ...sprite("europa"), size: 3 },
    systemMarkers: { url: atlasUrl, sun: sprite("sun"),
      bodies: Object.fromEntries(plan.heliocentricView.system.bodies.map(body => [body.id, sprite(body.id)])),
      phase: { url: lighting.url, columns: lighting.columns, rowCount: lighting.rowCount,
        frameCount: lighting.frameCount, minimumLightViewZ: -1, maximumLightViewZ: 1, baseLightAzimuthDegrees: 0 } },
    labels: { policy: { ...DEFAULT_LABEL_POLICY }, names: Object.fromEntries(Object.entries(BODIES).map(([id, body]) => [id, body.name])),
      stars: { policy: { ...STAR_LABEL_POLICY }, exposure: { ...catalogue.exposure }, records: catalogue.stars.flatMap((star, i) =>
        star.name ? [{ id: `star:${i}`, hip: star.hip, name: star.name, direction: star.direction, magnitude: star.magnitude }] : []) } },
  },
  viewBindings: [
    { kind: "silhouette-fit", target: index(materialRoot), minimumRadius: 1.5, unitScale: 2 / plan.camera.logicalBodyDiameter },
    { kind: "view-attribute", target: -1, property: "data-lod", source: "level-of-detail-stage", precision: null },
    { kind: "view-property", target: index(materialRoot), property: "--europa-billboard-opacity", source: "billboard-opacity", precision: 6 },
  ],
};
await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs", import.meta.url), presentation, objectControls);
const urls = [...entries.map(e => e.url), ...surfaces.flatMap(s => [s.thumbnail.url, s.map.url, ...(s.legend ? [s.legend.url] : [])]),
  ...plan.sky.faces.flatMap(f => [f.url, f.url2x, f.highContrastUrl, f.highContrastUrl2x]),
  plan.sun.asset.url, plan.sun.asset.url2x];
await prepareRuntimeAssetManifest({ planetId: "europa", urls: [...new Set(urls)], publicRoot: EUROPA_PUBLIC_ROOT,
  manifestPath: new URL("../runtime-assets.json", import.meta.url) });
console.log("Prepared Europa runtime presentation and asset inventory.");
