import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SourceEvidence } from "./source-evidence-values.mts";
import { requireFiniteNumber } from "../../tools/sources/source-values.mts";

import { readFile } from "node:fs/promises";
import { loadObjectContent } from "./load-object-content.mts";
import { prepareBandedEllipsoid } from "../../tools/objects/giant-layers/geometry.mts";

const STEPPED_OUTSET = "with-silhouette-stepped-outset";
interface SeamOutset { hysteresis: number; levels: { minimumDiameter: number; value: number }[]; }
interface SeamContract { model: string; seamBleed: number; presentationOverlap: number; rasterGutter: number; rasterOverscan: number; runtimeEdgeDiscovery: boolean; outset: SeamOutset | null; }
function readOutset(value: unknown): SeamOutset {
  const outset = SourceEvidence.parse(value);
  const levels = outset.field("levels");
  if (!Array.isArray(levels)) throw new TypeError("Invalid seam outset levels");
  return { hysteresis: requireFiniteNumber(outset.field("hysteresis")),
    levels: levels.map(input => { const level = SourceEvidence.parse(input);
      return { minimumDiameter: requireFiniteNumber(level.field("minimumDiameter")), value: requireFiniteNumber(Number(level.text("value"))) }; }) };
}
function readSeam(value: unknown): SeamContract {
  const evidence = SourceEvidence.parse(value);
  const runtimeEdgeDiscovery = evidence.field("runtimeEdgeDiscovery");
  assert.equal(typeof runtimeEdgeDiscovery, "boolean");
  if (typeof runtimeEdgeDiscovery !== "boolean") throw new TypeError("Invalid seam runtime contract");
  const model = evidence.text("model");
  return { model, runtimeEdgeDiscovery,
    seamBleed: requireFiniteNumber(evidence.field("seamBleed")),
    presentationOverlap: requireFiniteNumber(evidence.field("presentationOverlap")),
    rasterGutter: requireFiniteNumber(evidence.field("rasterGutter")),
    rasterOverscan: requireFiniteNumber(evidence.field("rasterOverscan")),
    outset: model.endsWith(STEPPED_OUTSET) ? readOutset(evidence.field("outset")) : null };
}
const PLANET_SURFACE_SEAMS: Record<string, SeamContract> = {};
for (const id of ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]) {
  const scene = SourceEvidence.parse(JSON.parse(await readFile(new URL("../../src/objects/" + id + "/prepared/scene.json", import.meta.url), "utf8"))).value;
  const loaded = await loadObjectContent(id);
  const geometry = loaded.descriptor.properties.recipe.sources.some(source => source.id === "geometry")
    ? await loaded.source("geometry") : null;
  const recipe = geometry === null ? null : SourceEvidence.parse(geometry);
  if (recipe?.field("schema") === "cssearth-banded-ellipsoid@1") {
    // The source parameters must generate the accepted retained geometry, not
    // merely declare a seam-policy label beside unrelated prepared transforms.
    const actual = prepareBandedEllipsoid(geometry);
    const { schema, ...prepared } = scene;
    assert.deepEqual(actual, prepared, id + ": seam parameters must generate the actual leaves");
    const surface = recipe.child("surface");
    const seamBleed = requireFiniteNumber(surface.field("seamBleed"));
    const overlap = requireFiniteNumber(surface.field("overlap"));
    const gutter = requireFiniteNumber(surface.field("gutter"));
    const overscan = requireFiniteNumber(surface.field("overscan"));
    PLANET_SURFACE_SEAMS[id] = {
      model: overscan > 0 ? "prepared-zero-seam-bleed-with-matched-raster-and-compositor-overlap"
        : "prepared-zero-seam-bleed-with-compositor-overlap",
      seamBleed, presentationOverlap: overlap, rasterGutter: gutter, rasterOverscan: overscan,
      runtimeEdgeDiscovery: false, outset: null,
    };
  } else {
    PLANET_SURFACE_SEAMS[id] = readSeam(SourceEvidence.parse(scene.preparedSurface ?? scene.body ?? scene.surface).field("seamRepair"));
  }
}

test("all prepared planet surfaces use the measured Chrome seam contract", () => {
  assert.deepEqual(Object.keys(PLANET_SURFACE_SEAMS), [
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ]);
  for (const [planet, seam] of Object.entries(PLANET_SURFACE_SEAMS)) {
    assert.ok([
      "prepared-zero-seam-bleed-with-compositor-overlap",
      "prepared-zero-seam-bleed-with-matched-raster-and-compositor-overlap",
      `prepared-exact-tiling-${STEPPED_OUTSET}`,
      `prepared-matched-raster-overscan-${STEPPED_OUTSET}`,
    ].includes(seam.model), `${planet} seam model`);
    assert.equal(seam.seamBleed, 0, `${planet} seam bleed`);
    if (seam.outset) {
      // The outset is published per silhouette step; any prepared overlap is the matched raster overscan.
      assert.ok(seam.model.includes("matched-raster") ? seam.presentationOverlap > 0 : seam.presentationOverlap === 0, `${planet} overlap without stretch`);
    } else {
      assert.ok(
        seam.presentationOverlap >= 0.005,
        `${planet} compositor overlap`,
      );
    }
    assert.ok(seam.rasterGutter > 0, `${planet} raster gutter`);
    if (seam.model.includes("matched-raster")) {
      assert.ok(seam.rasterOverscan > 0, `${planet} matched raster overscan`);
    } else {
      assert.equal(seam.rasterOverscan, 0, `${planet} raster overscan`);
    }
    assert.ok(
      seam.rasterOverscan <= seam.rasterGutter,
      `${planet} raster overscan stays inside its prepared gutter`,
    );
    assert.equal(seam.runtimeEdgeDiscovery, false, `${planet} runtime work`);
  }
});

test("stepped seam outsets stay between 0.35 and 0.6 CSS pixels across each silhouette step", () => {
  // Probed on Venus radar in Chrome: 0.42 px per edge hides the antialiased gaps
  // at the default zoom, while 1 px already shows misregistered texture at feature zoom.
  for (const [planet, { outset }] of Object.entries(PLANET_SURFACE_SEAMS)) {
    if (!outset) continue;
    assert.equal(outset.levels[0]?.minimumDiameter, 0, `${planet} first step`);
    for (const [index, level] of outset.levels.entries()) {
      const next: SeamOutset["levels"][number] | undefined = outset.levels[index + 1];
      if (!next) continue;
      assert.ok(next.minimumDiameter > level.minimumDiameter, `${planet} steps increase`);
      const largest: number = next.minimumDiameter * level.value;
      // A step is kept below its own threshold until the hysteresis margin runs out.
      const smallest: number = level.minimumDiameter * (1 - outset.hysteresis) * level.value;
      assert.ok(largest <= 0.6, `${planet} step ${index} reaches ${largest.toFixed(3)} px`);
      if (index > 0) assert.ok(smallest >= 0.35, `${planet} step ${index} falls to ${smallest.toFixed(3)} px`);
    }
  }
});
