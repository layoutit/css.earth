// Triton's Voyager colour lens: the limb placement evidence its authoring tool wrote, the manifest pins the lens reads, and the
// photometry the preparation reported (withheld policy, band levels onto the Rings Node calibration).
import assert from "node:assert/strict";
import test from "node:test";
import placement from "../../../../src/objects/triton/source/reference/voyager-color-placement.json" with { type: "json" };
import manifest from "../../../../src/objects/triton/source/manifest.json" with { type: "json" };
import oracle from "../../../../src/objects/triton/source/reference/voyager-color-oracle.json" with { type: "json" };
import raster from "../../../../src/objects/triton/source/preparation/raster.json" with { type: "json" };
import assets from "../../../../src/objects/triton/prepared/assets.json" with { type: "json" };
import { requireRecord } from "../../../../tools/sources/source-values.mts";
import { required } from "../../../../tools/contract/test-values.mts";

const frames = placement.frames as { id: string; observation: string; filter: string; kind: string; placed: boolean; pixelScaleKm: number;
  limb?: { accepted: boolean; rmsPixels: number; edgePoints: number; shiftPixels: number[] }; tiles?: { framePath: string; labelPath: string }[] }[];
const observations = [...new Set(frames.map(frame => frame.observation))];

test("every frame in the recipe was placed: the controlled colour set and five limb-placed approach triplets", () => {
  assert.deepEqual(observations, ["bland-2024-color", "approach-4-7km", "approach-8-6km", "approach-10-6km", "approach-23km", "approach-30km"]);
  assert.ok(frames.every(frame => frame.placed), "no frame was rejected");
  for (const observation of observations.slice(1)) {
    const triplet = frames.filter(frame => frame.observation === observation);
    assert.deepEqual(triplet.map(frame => frame.filter).sort(), ["GREEN", "UV", "VIOLET"], `${observation} is one green/violet/UV triplet`);
    assert.ok(triplet.every(frame => frame.kind === "geomed" && frame.limb?.accepted));
  }
  assert.equal(frames.filter(frame => frame.kind === "controlled-ortho").length, 12);
});

test("the limb fit corrected the recorded pointing by 49 to 256 pixels and fits each accepted limb within 1.3 pixels", () => {
  const limbs = frames.filter(frame => frame.limb).map(frame => required(frame.limb));
  assert.equal(limbs.length, 15);
  assert.ok(limbs.every(limb => limb.rmsPixels < 1.3 && limb.edgePoints >= 40), "each limb fit is tight and well sampled");
  const shifts = limbs.map(limb => Math.hypot(limb.shiftPixels[0]!, limb.shiftPixels[1]!));
  assert.ok(Math.min(...shifts) > 40 && Math.max(...shifts) > 200 && Math.max(...shifts) < 300, "the SEDR pointing error the fit removed runs from tens to hundreds of pixels");
});

test("the recipe's datum shift is the measured residual against the controlled release, within its stated uncertainty", () => {
  const route = placement.route;
  assert.deepEqual(route.datumShiftDegrees, { longitude: 0.78, latitude: -0.8 });
  assert.ok(Math.hypot(route.datumShiftDegrees.longitude, route.datumShiftDegrees.latitude) < 1.2, "Bland et al. state their absolute alignment as about one degree");
  const mean = required(oracle.meanResidualDegrees);
  assert.ok(oracle.comparedFrames >= 9 && oracle.frames.every(frame => !frame.compared || (frame.correlation ?? 0) > 0.05));
  assert.ok(Math.abs(mean.longitude - route.datumShiftDegrees.longitude) < 0.1 && Math.abs(mean.latitude - route.datumShiftDegrees.latitude) < 0.1, "the oracle's mean residual is the recipe datum within a tile cell");
  assert.ok(required(oracle.residualSpreadKm) < 8, "frame-to-frame scatter stays a few kilometres");
});

test("every tile the placement wrote is pinned for the lens and its geometry label for the photometry", () => {
  const inputs = manifest.inputs as { path: string; consumers: string[] }[];
  const pinned = new Map(inputs.map(input => [input.path, input.consumers]));
  for (const frame of frames) for (const tile of required(frame.tiles)) {
    assert.deepEqual(pinned.get(tile.framePath), ["voyager-color"], tile.framePath);
    assert.deepEqual(pinned.get(tile.labelPath), ["voyager-color-photometry"], tile.labelPath);
  }
  assert.equal(inputs.filter(input => input.consumers.includes("voyager-color")).length, frames.flatMap(frame => frame.tiles ?? []).length);
});

test("the prepared lens composed every observation on one calibration, and let approach frames fill what the controlled frames view too steeply", () => {
  const surface = requireRecord(required((raster.surfaces as { id: string }[]).find(surface => surface.id === "voyager-color")));
  const profile = requireRecord(requireRecord(requireRecord(surface.science).photometry).profile);
  assert.equal(profile.withheld, "next-observation");
  assert.deepEqual(profile.bandLevels, { reference: "approach-4-7km", cellDegrees: 0.25, minimumOverlapPixels: 1000 });
  // The interpretation report is keyed by prepared density; the lens ships at the one density.
  const prepared = requireRecord(required(Object.values(requireRecord(requireRecord(required(requireRecord(assets.surfaces)["voyager-color"])).interpretation))[0]));
  const photometry = requireRecord(prepared.photometry), levels = requireRecord(photometry.bandLevels);
  assert.equal(levels.reference, "approach-4-7km");
  const gains = requireRecord(levels.gains) as Record<string, number[]>;
  assert.deepEqual(Object.keys(gains).sort(), [...observations].sort());
  assert.deepEqual(gains["approach-4-7km"], [1, 1, 1]);
  // The controlled release's voycal I/F is darker than the Rings Node calibration by 16 to 32 percent, band by band.
  for (const [band, gain] of gains["bland-2024-color"]!.entries()) assert.ok(gain > 1.1 && gain < 1.4, `bland band ${band} gain ${gain}`);
  for (const observation of observations.slice(2)) for (const gain of gains[observation]!) assert.ok(gain > 0.75 && gain < 1.05, `${observation} ${gain}`);
  assert.ok((levels.pairs as unknown[]).length >= 8, "the overlap graph ties every observation to the reference");
  const counts = requireRecord(photometry.observations) as Record<string, { correctedPixels: number; withheldPixels: number }>;
  assert.ok(counts["bland-2024-color"]!.withheldPixels > counts["bland-2024-color"]!.correctedPixels * 0.8, "the controlled colour frames view about half their footprint beyond 60 degrees");
  assert.ok(counts["approach-4-7km"]!.correctedPixels > counts["bland-2024-color"]!.correctedPixels, "the 4.7 km triplet owns more of the map than the withheld controlled frames left it before");
  const levelMatching = prepared.levelMatching as { observation: string; gain: number; pooled?: boolean; clippedPixels?: number }[];
  assert.equal(new Set(levelMatching.map(level => level.gain)).size, 1, "one pooled brightness gain for the whole lens");
  assert.ok(levelMatching.every(level => level.pooled && level.gain > 0.5 && level.gain < 1.5), "the base and the corrected colour are on comparable scales");
  assert.ok(required(levelMatching[0]).clippedPixels! < Number(photometry.correctedPixels) * 0.002, "at most the brightest 0.1 percent clips");
});
