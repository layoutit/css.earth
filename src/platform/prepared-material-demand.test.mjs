import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runtimeDefinition as definition } from "../planets/mars/runtime/definition.mjs";
import { initialObjectSelection } from "./object-runtime-contract.mjs";
import { resolvePreparedPresentation, selectedPreparedVariant } from "./prepared-presentation.mjs";
import { preparedMaterialAddress } from "./prepared-material.mjs";
import { resolvePreparedMaterialDemand } from "./prepared-material-demand.mjs";

const track = definition.materials[0];
const initial = initialObjectSelection(definition.controls);
const selected = shadows => selectedPreparedVariant(definition, { ...initial, shadows }).materials[0];
const view = frame => ({ skySunViewDirection: [Math.sqrt(Math.max(0, 1 - (-1 + frame * 2 / 255) ** 2)), 0, 1 - frame * 2 / 255] });

test("independent material pools preserve sealed Earth neighborhood history and visibility rules",()=>{
  const fixture=JSON.parse(readFileSync(new URL("./test/fixtures/earth-material-demand-reference.json",import.meta.url)));
  assert.match(fixture.source.sha256,/^[a-f0-9]{64}$/);assert.equal(fixture.records.length,132);
  let key=null,previous={};
  for(const {selection,view,expected} of fixture.records){
    const nextKey=JSON.stringify(selection);if(nextKey!==key){previous={};key=nextKey;}
    const selected=selectedPreparedVariant(fixture.prepared,selection),required=[],prewarm=[],neighborhoods={};
    for(const track of fixture.prepared.materials){
      const demand=resolvePreparedMaterialDemand(track,selected.materials.find(value=>value.track===track.id),view,fixture.prepared.camera,previous[track.id]);
      required.push(...demand.required);prewarm.push(...demand.prewarm);neighborhoods[track.id]={row:demand.row,rows:demand.rows};previous[track.id]=demand;
    }
    assert.deepEqual({required,prewarm,neighborhoods},expected,JSON.stringify({selection,view}));
  }
});

test("current-row demand follows every atmosphere phase in both ground modes without neighbors", () => {
  for (let frame = 0; frame < 256; frame++) {
    const demand = resolvePreparedMaterialDemand(track, selected(true), view(frame), definition.camera);
    assert.deepEqual(demand.required, [`lighting:${frame}`]); assert.deepEqual(demand.prewarm, []);
    const shadowless = resolvePreparedMaterialDemand(track, selected(false), view(frame), definition.camera);
    assert.deepEqual(shadowless.required, [`lighting:${frame + 256}`]);
    const plan = resolvePreparedPresentation(definition, { selection: { ...initial, shadows: true }, view: view(frame) });
    assert.deepEqual(plan.required, ["surface:normal", "poles:normal", `lighting:${frame}`]);
  }
});

test("same-column fallback is a prepared address rule independent of one-frame rows", () => {
  const bank = { rows: [{ row: 0, resource: "first", firstFrame: 0, lastFrame: 3 },
    { row: 1, resource: "second", firstFrame: 4, lastFrame: 7 }],
    frames: Array.from({ length: 8 }, (_, frame) => ({ frame, row: Math.floor(frame / 4), resource: frame < 4 ? "first" : "second" })) };
  const record = { demand: { framesPerRow: 4, fallback: "same-column" } };
  const resources = { has: key => key === "first", readyKeys: () => ["unrelated", "first"] };
  assert.equal(preparedMaterialAddress(record, { bank, frame: 6, row: 1, address: bank.frames[6] }, resources).frame, 2);
  assert.equal(preparedMaterialAddress({ demand: { ...record.demand, fallback: "hold" } },
    { bank, frame: 6, row: 1, address: bank.frames[6] }, resources), null);
});

test("directional prewarming reverses and preserves its committed frame while showing a fixed address", async () => {
  const { runtimeDefinition: definition } = await import("../planets/jupiter/runtime/definition.mjs");
  const track = definition.materials[0], initial = initialObjectSelection(definition.controls);
  const variant = shadows => selectedPreparedVariant(definition, { ...initial, shadows }).materials[0];
  const demand = (pitch, shadows, previous, configured = track) => resolvePreparedMaterialDemand(configured,
    variant(shadows), { controlPitch: pitch }, definition.camera, previous);
  const forward = demand(0, true);
  assert.equal(forward.frame, 136); assert.deepEqual(forward.required, ["lighting:34"]);
  assert.deepEqual(forward.prewarm, ["lighting:35", "lighting:36"]);
  const fixed = demand(89, false, forward);
  assert.equal(fixed.frame, 136); assert.deepEqual(fixed.required, ["shadowless"]); assert.deepEqual(fixed.prewarm, []);
  const reverse = demand(89, true, fixed);
  assert.equal(reverse.frame, 6); assert.deepEqual(reverse.required, ["lighting:1"]);
  assert.deepEqual(reverse.prewarm, ["lighting:0"]);
  assert.deepEqual(demand(89, true, reverse).prewarm, []);
  assert.deepEqual(demand(0, true, undefined, { ...track, demand: { ...track.demand, capacity: 2 } }).prewarm, ["lighting:35"]);
  assert.equal(demand(0, false).frame, track.demand.defaultFrame);
});

test("nearest-frame and same-column select different prepared positions through the same lookup", async () => {
  const { runtimeDefinition: definition } = await import("../planets/jupiter/runtime/definition.mjs");
  const track = definition.materials[0], bank = track.banks[0], keys = ["lighting:2", "lighting:6"];
  const resources = { has: key => keys.includes(key), readyKeys: () => keys };
  for (const [frame, expected] of [[0,8], [15,11], [20,24], [180,27]]) {
    assert.equal(preparedMaterialAddress(track, { bank, frame, row: bank.frames[frame].row, address: bank.frames[frame] }, resources).frame, expected);
  }
  const state = { bank, frame: 20, row: 5, address: bank.frames[20] };
  assert.equal(preparedMaterialAddress({ ...track, demand: { ...track.demand, fallback: "same-column" } }, state, resources).frame, 24);
  state.frame=21; state.address=bank.frames[21];
  assert.equal(preparedMaterialAddress(track, state, resources).frame, 24);
  assert.equal(preparedMaterialAddress({ ...track, demand: { ...track.demand, fallback: "same-column" } }, state, resources).frame, 25);
});

test("neighborhood demand clamps prepared rows and stores shadowless history in the committed bank", async () => {
  const { runtimeDefinition: definition } = await import("../planets/uranus/runtime/definition.mjs");
  const track = definition.materials[0], initial = initialObjectSelection(definition.controls);
  const variant = (shadows, lensId = initial.lensId) => selectedPreparedVariant(definition, { ...initial, shadows, lensId }).materials[0];
  const view = z => ({ sunViewDirection: [0, 0, z], reference: { sunViewDirection: [0, 0, 0] }, controlPitch: 89 });
  const resolve = (z, shadows, previous, lensId) => resolvePreparedMaterialDemand(track, variant(shadows, lensId), view(z), definition.camera, previous);
  const start = resolve(0, true);
  assert.deepEqual(start.required, ["row:normal:5", "row:normal:6", "row:normal:7"]);
  const hidden = resolve(0, false, start), moved = resolve(-1, false, hidden);
  assert.deepEqual(moved.required, hidden.required); assert.equal(moved.row, 6); assert.equal(moved.frame, 226);
  assert.deepEqual(resolve(-2, true, moved).required, ["row:normal:14", "row:normal:15"]);
  assert.deepEqual(resolve(2, true, moved).required, ["row:normal:0", "row:normal:1"]);
  const newBank = resolve(-1, false, moved, "methane");
  assert.equal(newBank.row, 14); assert.deepEqual(newBank.required, ["row:methane:13", "row:methane:14", "row:methane:15"]);
  assert.deepEqual(newBank.prewarm, []);
  const renamed = { ...variant(false), modeLabel: "diagnostic label" };
  const renamedPlan = resolvePreparedMaterialDemand(track, renamed, view(0), definition.camera);
  assert.deepEqual(resolvePreparedMaterialDemand(track, renamed, view(-1), definition.camera, renamedPlan).required, hidden.required);
});

test("transition demand requires the current row away from the default pose when enabled or changing banks", async () => {
  const { runtimeDefinition: definition } = await import("../planets/neptune/runtime/definition.mjs");
  const track = definition.materials[0], initial = initialObjectSelection(definition.controls);
  const demand = (pitch, z, shadows, lensId, previous) => resolvePreparedMaterialDemand(track,
    selectedPreparedVariant(definition, { ...initial, shadows, lensId }).materials[0],
    { controlPitch: pitch, sunViewDirection: [0, 0, z], reference: { sunViewDirection: [1, 0, 0] } }, definition.camera, previous);
  const atDefault = demand(definition.camera.defaultControlPitchDegrees, 0, false, "normal");
  assert.deepEqual(atDefault.required, []);
  const hidden = demand(89, -1, false, "normal", atDefault);
  assert.deepEqual(hidden.required, []);
  const next = demand(89, -1, false, "methane", hidden);
  assert.deepEqual(next.required, ["lighting:methane:14"]);
  assert.deepEqual(demand(0, 1, false, "methane", next).required, []);
  assert.deepEqual(demand(0, 1, true, "methane", next).required, ["lighting:methane:0"]);
  assert.deepEqual(demand(definition.camera.defaultControlPitchDegrees, 1, true, "normal", next).required, []);
});

test("symmetric prewarming fills bounded prepared neighbors and stops for the fixed material", async () => {
  const { runtimeDefinition: definition } = await import("../planets/mercury/runtime/definition.mjs");
  const initial = initialObjectSelection(definition.controls);
  const resolve = (z, shadows) => resolvePreparedPresentation(definition, { selection: { ...initial, shadows }, view: { sunViewDirection: [1, 0, z] } });
  for (const [z, row, neighbors] of [[-1, 0, [1, 2]], [0, 16, [15, 17]], [1, 31, [30, 29]]]) {
    const plan = resolve(z, true);
    assert.deepEqual(plan.required, [`lighting:${row}`, "surface:normal", "poles"]);
    assert.deepEqual(plan.prewarm, neighbors.map(row => `lighting:${row}`));
  }
  assert.deepEqual(resolve(0, false).required, ["shadowless", "surface:normal", "poles"]);
  assert.deepEqual(resolve(0, false).prewarm, []);
});
