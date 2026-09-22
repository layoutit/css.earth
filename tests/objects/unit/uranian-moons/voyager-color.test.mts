// The five Uranian moons' Voyager colour lenses: each frame placed by limb fit and registered to the moon's Schenk mosaic,
// every placed tile pinned, and the prepared composite reporting its band levels. One test file, five packages: the route is
// the same and the numbers per moon are read from their own reports.
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireRecord } from "../../../../tools/sources/source-values.mts";
import { required } from "../../../../tools/contract/test-values.mts";

const MOONS = ["miranda", "ariel", "umbriel", "titania", "oberon"] as const;
const root = resolve(import.meta.dirname, "../../../..");
const read = async (moon: string, path: string) => JSON.parse(await readFile(resolve(root, "src/objects", moon, path), "utf8"));

interface Frame { id: string; observation: string; filter: string; placed: boolean; pixelScaleKm: number; limb?: { accepted: boolean; edgePoints: number; rmsPixels: number; seed: string; groundFloor?: number };
  mosaic?: { correlation: number | null; applied: boolean; shiftPixels: number[] }; tiles?: { id: string; framePath: string; labelPath: string }[] }

for (const moon of MOONS) {
  test(`${moon}: every frame in the recipe was tried, at least one complete colour set placed, and each placed frame registered to the mosaic where the disc allows`, async () => {
    const [recipe, placement, oracle] = await Promise.all(["source/preparation/voyager-color-frames.json", "source/reference/voyager-color-placement.json", "source/reference/voyager-color-oracle.json"].map(path => read(moon, path)));
    assert.equal(recipe.registration, "limb-then-mosaic");
    assert.equal(recipe.oracle.reference, "mosaic");
    assert.deepEqual(recipe.route.datumShiftDegrees, { longitude: 0, latitude: 0 }, "the mosaic registration replaces a datum shift");
    const frames = placement.frames as Frame[];
    const recipeFrames = recipe.observations.flatMap((observation: { frames: { id: string }[] }) => observation.frames.map(frame => frame.id));
    assert.deepEqual([...frames.map(frame => frame.id)].sort(), [...recipeFrames].sort(), "the report covers the recipe frame for frame (a frame the limb rejects is reported before its set is placed)");
    const sets = new Map<string, Set<string>>();
    for (const frame of frames) if (frame.placed) sets.set(frame.observation, (sets.get(frame.observation) ?? new Set()).add(frame.filter));
    const complete = [...sets].filter(([, filters]) => filters.size === 3).map(([id]) => id);
    assert.ok(complete.length >= 1, `${moon} places at least one green/violet/UV set`);
    for (const frame of frames.filter(frame => frame.placed)) {
      assert.ok(required(frame.limb).accepted && required(frame.limb).rmsPixels < 3, `${frame.id} limb`);
      const mosaic = required(frame.mosaic);
      if (mosaic.applied) assert.ok(required(mosaic.correlation) >= 0.2 && Math.hypot(mosaic.shiftPixels[0]!, mosaic.shiftPixels[1]!) <= 30, `${frame.id} registration`);
    }
    assert.equal(oracle.reference, "mosaic");
    assert.ok(oracle.comparedFrames >= 1 && oracle.meanCorrelation > 0.2, `${moon} oracle correlation ${oracle.meanCorrelation}`);
    for (const frame of frames.filter(frame => frame.placed)) assert.ok(typeof required(frame.limb).groundFloor === "number", `${frame.id} records the ground floor its tiles used`);
  });

  test(`${moon}: the whole-disc colour is tied to Bell and McCord (1991) and the prepared report shows the measured ratios and gains`, async () => {
    const [raster, assets] = await Promise.all(["source/preparation/raster.json", "prepared/assets.json"].map(path => read(moon, path)));
    const lens = requireRecord(required((raster.surfaces as { id: string }[]).find(surface => surface.id === "voyager-color")));
    const policy = requireRecord(requireRecord(requireRecord(requireRecord(lens.science).photometry).profile).bandRatios);
    assert.equal(policy.reference, "GREEN"); assert.equal(policy.source, "bell-mccord-1991");
    const ratios = requireRecord(policy.ratios);
    for (const band of ["VIOLET", "UV"]) assert.ok(typeof ratios[band] === "number" && (ratios[band] as number) > 0.85 && (ratios[band] as number) < 1.1, `${band} ratio read from Fig. 2`);
    const report = requireRecord(requireRecord(requireRecord(requireRecord(requireRecord(assets.surfaces)["voyager-color"]).interpretation)[2]).photometry);
    const tie = requireRecord(report.bandRatios);
    assert.deepEqual(tie.published, ratios);
    for (const band of ["VIOLET", "UV"]) assert.ok((requireRecord(tie.measured)[band] as number) > 0.7 && (requireRecord(tie.measured)[band] as number) < 1.3, `${band} measured ratio ${requireRecord(tie.measured)[band]}`);
    const gains = tie.gains as number[]; assert.equal(gains[0], 1); for (const gain of gains) assert.ok(gain > 0.8 && gain < 1.3, `gain ${gain} stays a calibration-sized correction`);
  });

  test(`${moon}: every tile of a complete set is pinned for the lens with its geometry label, and the lens names those sets`, async () => {
    const [manifest, raster, placement] = await Promise.all(["source/manifest.json", "source/preparation/raster.json", "source/reference/voyager-color-placement.json"].map(path => read(moon, path)));
    const inputs = manifest.inputs as { id: string; path: string; consumers: string[]; observation?: string; filter?: string; imageId?: string }[];
    const tiles = inputs.filter(input => input.consumers.includes("voyager-color")), labels = inputs.filter(input => input.consumers.includes("voyager-color-photometry"));
    assert.ok(tiles.length >= 3 && tiles.length % 3 === 0, "tiles come in complete filter sets");
    assert.equal(labels.length, tiles.length);
    for (const tile of tiles) assert.ok(labels.some(label => label.imageId === tile.id), `${tile.id} has its geometry label`);
    const lens = requireRecord(required((raster.surfaces as { id: string }[]).find(surface => surface.id === "voyager-color")));
    const profile = requireRecord(requireRecord(requireRecord(lens.science).photometry).profile);
    const weights = requireRecord(profile.observationWeights);
    assert.deepEqual(Object.keys(weights).sort(), [...new Set(tiles.map(tile => tile.observation))].sort(), "the recipe weighs exactly the pinned sets");
    assert.equal(profile.withheld, "next-observation");
    assert.ok(Object.hasOwn(weights, requireRecord(profile.bandLevels).reference as string), "the band-level reference is one of the sets");
    assert.equal(requireRecord(lens.science).monochromeBase, "normal");
    const frames = placement.frames as Frame[];
    for (const tile of tiles) assert.ok(frames.some(frame => frame.placed && frame.tiles?.some(t => t.framePath === tile.path)), `${tile.path} was written by the placement`);
  });
}
