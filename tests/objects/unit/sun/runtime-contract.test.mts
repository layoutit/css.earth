// Replaces the retired static-lane Sun tests (capability-preparation, preparation, prepared-presentation and the
// former runtime-contract test). Modelled on tests/objects/unit/moon/runtime-contract.test.mts (generic lane); the
// science assertions (FITS colours, magnetic polarity, legends, world context, forbidden render paths, four-layer
// lens replacement) are kept.
import { required } from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import runtimeDefinition from "../../../../src/objects/sun/prepared/runtime.json" with { type: "json" };
import assets from "../../../../src/objects/sun/prepared/assets.json" with { type: "json" };
import scene from "../../../../src/objects/sun/prepared/scene.json" with { type: "json" };
import lenses from "../../../../src/objects/sun/prepared/lenses.json" with { type: "json" };
import controls from "../../../../src/objects/sun/prepared/controls.json" with { type: "json" };
import panel from "../../../../src/objects/sun/prepared/panel.json" with { type: "json" };
import text from "../../../../src/objects/sun/prepared/text.json" with { type: "json" };
import raster from "../../../../src/objects/sun/source/preparation/raster.json" with { type: "json" };
import { objectRuntimePackageTests, preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
import { validateInventory } from "../../../../src/platform/runtime-asset-closure.mts";
import { createSourceManifest } from "../../../../src/platform/source-manifest.mts";
import { scientificFalseColor, prepareFitsMap, readFitsPrimary } from "../../../../tools/objects/observation/fits.mts";
import { SCENE_OBJECTS } from "../../../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../../../../tools/ci/check-object-runtime-ownership.mts";
import { projectRoot } from "../../fixtures.mts";
import { resolve } from "node:path";

const LENS_IDS = ["photosphere", "magnetic", "chromosphere", "corona", "cor1-density"];
const LAYERS = ["surface", "poles", "corona", "limb"] as const;

objectRuntimePackageTests(runtimeDefinition);

test("binds the exact Sun source and runtime closures", async () => {
  const source = await createSourceManifest({ planetId: "sun", planetName: "Sun", sourceRoot: resolve(projectRoot, "src/objects/sun/source") });
  // 38 retired-lane inputs + 7 authored records that moved from documents to local inputs (the navigation recipe included); 3 documents remain.
  assert.deepEqual(await source.verify(), { inputCount: 50, generatedIntermediateCount: 0, documentCount: 4 });
  const runtime = JSON.parse(await readFile(new URL("../../../../src/objects/sun/inventory.json", import.meta.url), "utf8"));
  assert.equal(validateInventory("sun", runtime), true);
  // 4 lenses x (surface, poles, corona, limb) at the one prepared density + 4 thumbnails.
  assert.equal(runtime.assets.length, 20);
});

test("Sun's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: SCENE_OBJECTS.filter(object => object.id === "sun") });
  assert.equal(audit.complete, true);
  assert.ok(audit.sharedClosure.includes("src/renderers/css/universe/world-context-runtime.ts"));
  for (const name of ["runtime/object-runtime", "rendering/prepared-residency", "rendering/object-selection-runtime", "rendering/prepared-playback"]) {
    assert.ok(audit.sharedClosure.includes(`src/renderers/css/${name}.ts`));
  }
});

test("Sun is prepared by the generic raster lane as an emissive sphere with flat polar caps and no lighting", async () => {
  assert.equal(scene.schema, "csssun-prepared-runtime-scene@3");
  assert.equal(scene.runtimeGeometry, false);
  assert.equal(scene.runtimeRasterization, false);
  assert.equal(scene.body.equatorialRadius, 248);
  assert.deepEqual([scene.body.latitudeSegments, scene.body.longitudeSegments], [16, 32]);
  assert.equal(scene.body.axialTiltDegrees, 7.25);
  assert.equal(scene.body.sourceRotation, 2311);
  assert.match(scene.body.polarPreparation, /flat centre cap per pole/);
  // 448 band leaves + one flat cap per pole = 450 (the retired lane's 32-segment bands are not carried; see the README).
  assert.equal(scene.counts.textureLeafCount, 450);
  assert.equal(scene.counts.polarLeafCount, 2);
  assert.equal(scene.material.model, "emissive");
  assert.equal(scene.material.runtimeLighting, false);
  assert.equal(Object.hasOwn(assets, "lighting"), false);
  assert.equal(Object.hasOwn(assets, "atmosphere"), false);
  assert.equal(assets.emission.offLimbContext.logicalSize, 768);
  assert.equal(assets.emission.limbMaterial.logicalSize, 496);
  // The COR1 density lens is an off-limb corona view with no surface map of its own.
  assert.deepEqual(Object.keys(assets.surfaces), LENS_IDS.filter(id => id !== "cor1-density"));
  assert.deepEqual(lenses.controls.map(({ id }) => id), LENS_IDS);
  assert.equal(lenses.defaultLens, "photosphere");
  assert.deepEqual(controls.settings.controls.map(control => control.name), ["speed"]);
  assert.equal(runtimeDefinition.sun, null);
  assert.equal(Object.hasOwn(runtimeDefinition.sky, "sun"), false);
  assert.deepEqual(runtimeDefinition.materials, []);
  assert.equal(runtimeDefinition.tree.nodes.some(node => node.className?.includes("sun-material-composite")), false);
  for (const layer of ["corona", "limb"]) assert.ok(runtimeDefinition.tree.nodes.some(node => node.className === `sun-${layer}-layer planet-render-root`));
  assert.equal(runtimeDefinition.viewBindings.filter(binding => binding.kind === "silhouette-fit").length, 2);
  const context = JSON.parse(await readFile(new URL("../../../../src/objects/sun/prepared/world-context.json", import.meta.url), "utf8"));
  assert.equal(context.focus.id, "sun");
  assert.deepEqual(scene.worldFrame, context.frame);
  assert.deepEqual(scene.camera.projection, context.camera.presentation.projection);
});

test("publishes the NASA facts with their citations and every lens legend", () => {
  assert.equal(panel.facts.length + panel.moreFacts.length, 3);
  const facts = [...panel.facts, ...panel.moreFacts];
  for (const [id, value, url] of [
    ["rotation-period", "About 25 days", "https://science.nasa.gov/sun/facts/"],
    ["activity-cycle", "About 11 years", "https://science.nasa.gov/heliophysics/focus-areas/solar-science/"],
    ["magnetic-cycle", "About 22 years", "https://science.nasa.gov/heliophysics/focus-areas/solar-science/"],
  ] as const) {
    const fact = facts.find(entry => entry.id === id);
    assert.equal(fact?.value, value);
    assert.equal(fact?.source?.url, url);
    assert.equal(fact?.source?.path, "source/editorial/factsheet-review.json");
  }
  const byId = new Map(controls.lenses.controls.map(control => [control.id, control]));
  for (const control of lenses.controls) {
    const shell = required(byId.get(control.id));
    assert.equal(typeof Object.getOwnPropertyDescriptor(text.datasets, control.id)?.value?.summary, "string");
    if (control.falseColor) assert.ok(shell.legend, `${control.id} declares a false-colour scale without a legend`);
    if (shell.legend?.kind === "scale") assert.ok((shell.legend.colors?.length ?? 0) === 64 && (shell.legend.labels?.length ?? 0) >= 2);
  }
  // Legend endpoints are the authored FITS palettes (content recipe.palette = raster fits.color.palette).
  const magnetic = required(byId.get("magnetic")).legend!;
  assert.deepEqual([magnetic.colors![0], magnetic.colors!.at(-1)], ["rgb(28 95 190)", "rgb(255 224 110)"]);
});

test("scientific FITS colors preserve signed polarity and authored log intensity endpoints", () => {
  const synoptic = (id: string) => required(raster.surfaces.find(surface => surface.id === id)).science.synoptic;
  const signed = synoptic("magnetic").fits!.color as Parameters<typeof scientificFalseColor>[1];
  assert.deepEqual(scientificFalseColor(-250, signed), [28, 95, 190]);
  assert.deepEqual(scientificFalseColor(0, signed), [95, 32, 11]);
  assert.deepEqual(scientificFalseColor(250, signed), [255, 224, 110]);
  for (const id of ["chromosphere", "corona"]) {
    const color = synoptic(id).fits!.color as { kind: "positive-log"; range: [number, number]; palette: number[][] };
    assert.deepEqual(scientificFalseColor(color.range[0], color), color.palette[0]);
    assert.deepEqual(scientificFalseColor(color.range[1], color), color.palette.at(-1));
  }
});

test("FITS decoding rejects incomplete data and preserves signed floating observations", () => {
  const cards = ["SIMPLE  = T", "BITPIX  = -32", "NAXIS   = 2", "NAXIS1  = 2", "NAXIS2  = 2", "END"].map(card => card.padEnd(80)).join("");
  const bytes = Buffer.alloc(2880 * 2, 0); bytes.write(cards, "ascii");
  [-250, 250, 0, NaN].forEach((value, index) => bytes.writeFloatBE(value, 2880 + index * 4));
  assert.deepEqual([...readFitsPrimary(bytes).values], [-250, 250, 0, NaN]);
  assert.throws(() => readFitsPrimary(bytes.subarray(0, 2884)), /truncated/i);
  const recipe: Parameters<typeof prepareFitsMap>[3] = { bitpix: -32, width: 2, height: 2, latitude: "sine-latitude", nearestLatitudeLimit: 1, positiveOnly: false, color: { kind: "signed-asinh", softening: 8, maximum: 250, palette: [[28, 95, 190], [95, 32, 11], [255, 224, 110]] } };
  const map = prepareFitsMap(bytes, 2, 2, recipe);
  assert.equal(map.length, 16);
  assert.deepEqual([map[3], map[7], map[11], map[15]], [255, 255, 255, 255]);
  assert.throws(() => prepareFitsMap(bytes, 2, 2, { ...recipe, width: 4 }), /geometry/);
  // Longitude grows to the right, as the mesh places every atlas: the first source column (the lowest Carrington longitude, in
  // the direction the Sun turns) lands at the left edge. The bottom row of this 2x2 map is -250 then 250.
  assert.deepEqual([...map.subarray(8, 11)], [...scientificFalseColor(-250, recipe.color)]);
  assert.deepEqual([...map.subarray(12, 15)], [...scientificFalseColor(250, recipe.color)]);
});

test("preserves both HMI magnetic polarities in the prepared magnetic lens", async () => {
  const source = await readFile(new URL("../../../../public/scenes/sun/sun-surface-magnetic@2x.webp", import.meta.url));
  const { data } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let negative = 0, positive = 0;
  for (let offset = 0; offset < data.length; offset += 3) {
    if (data[offset + 2] > data[offset] + 20) negative += 1;
    if (data[offset] > data[offset + 2] + 20) positive += 1;
  }
  assert.ok(negative > 1_000);
  assert.ok(positive > 1_000);
});

test("keeps the runtime free of forbidden render paths", async () => {
  const [acquisition, client, styles] = await Promise.all([
    readFile(new URL("../../../../src/objects/sun/source/preparation/acquisition.json", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/dist/index.js", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/styles/planet-surfaces.css", import.meta.url), "utf8"),
  ]);
  assert.equal(/createElement\(["']canvas/u.test(client), false);
  assert.doesNotMatch(styles, /clip-path|mask(?:-image)?\s*:|filter\s*:|gradient\(|mix-blend-mode|image-set\(/u);
  assert.doesNotMatch(`${client}\n${styles}`, /data-speed|\bslow\b/u);
  assert.doesNotMatch(styles, /\.sun-body\s*\{[^}]*opacity\s*:/su);
  assert.doesNotMatch(acquisition, /\.\.\/\.\.\/saturn\/source/u);
});

function textures(f: Awaited<ReturnType<typeof preparedSelectionFixture>>) {
  const nodes = f.stage.querySelectorAll("*");
  const body = required(nodes.find((n: { className: string }) => n.className === "polycss-mesh sun-body"));
  return [body.style.getPropertyValue("--sun-surface-image"), body.style.getPropertyValue("--sun-poles-image"),
    required(nodes.find((n: { className: string }) => n.className === "sun-corona-layer planet-render-root")).style.getPropertyValue("--sun-corona-image"),
    required(nodes.find((n: { className: string }) => n.className === "sun-limb-layer planet-render-root")).style.getPropertyValue("--sun-limb-image")];
}

test("all four sourced solar layers wait for the complete replacement group", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*"), before = textures(f), next = required(runtimeDefinition.controls.lenses).controls[1].id;
    const action = f.selection.dispatch({ kind: "lens", id: next }); await f.flush();
    const jobs = f.jobs.filter(job => !job.done); assert.equal(jobs.length, LAYERS.length);
    for (const job of jobs.slice(0, 3)) { job.done = true; job.resolve(); } await f.flush();
    assert.deepEqual(textures(f), before); assert.notEqual(f.stage.dataset.lens, next);
    jobs[3].done = true; jobs[3].resolve(); await f.settle(); assert.equal(await action, true);
    assert.ok(textures(f).every((value, index) => value !== before[index]));
    assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Sun lens selection keeps the retained tree and switches only the four layers", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const records = f.stage.querySelectorAll("*");
    for (const id of [...LENS_IDS.slice(1), LENS_IDS[0]]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.equal(required(f.selection.state().committed).lensId, id);
      assert.deepEqual(f.stage.querySelectorAll("*"), records);
      assert.equal(f.stage.dataset.lens, id);
    }
    assert.equal(f.inputs.get("shadows"), undefined, "an emissive body declares no Shadows toggle");
    assert.equal(f.inputs.get("atmosphere"), undefined);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
