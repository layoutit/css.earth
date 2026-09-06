import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../../site/objects.mjs";
import { createPreparedMaterialPublisher, preparedMaterialAddress, preparedMaterialFrame, preparedMaterialState } from "./prepared-material.mjs";
import { resolvePreparedMaterialDemand } from "./prepared-material-demand.mjs";
import { retainedPresentationFixture } from "./test/object-runtime-package.mjs";
import { PREPARED_JUPITER_LIGHTING as lighting } from "../planets/jupiter/runtime/preparedLighting.mjs";

const definitions = await Promise.all(OBJECTS.map(async ({id}) => (await import(`../planets/${id}/runtime/definition.mjs`)).runtimeDefinition));
const view = z => ({ sunViewDirection: [Math.sqrt(1-z*z), 0, z], sceneMatrix: "moved",
  reference: { sunViewDirection: [0, 0, 1], sceneMatrix: "initial" } });

test("Earth's prepared zoom cutoff clears atmosphere pixels and demand, then restores the enabled globe layer", () => {
  const definition = definitions.find(d => d.id === "earth"), track = definition.materials.find(t => t.id === "atmosphere");
  const variant = definition.variants.find(v => v.when.lensId === "normal" && v.when.atmosphere && !v.when.shadows);
  const selected = variant.materials.find(m => m.track === track.id), f = retainedPresentationFixture(definition);
  assert.equal(track.maximumZoom, 4);
  try {
    const element = f.document.createElement("s");
    element.style.transform = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
    const publisher = createPreparedMaterialPublisher(track, element, definition.camera);
    let reads = 0;
    const resources = { ...f.resources, has: () => true, url(key) { reads++; return f.resources.url(key); } };
    const globe = { ...view(0), zoom: 4 };
    assert.equal(resolvePreparedMaterialDemand(track, selected, globe).required.length, 1);
    publisher.publish(selected, globe, resources); assert.match(element.style.backgroundImage, /earth-atmosphere-row/);
    const before = reads;
    for (const zoom of [4.001, 8, 1024]) for (const phase of [-1, 0, 1]) {
      const camera = { ...view(phase), zoom }, demand = resolvePreparedMaterialDemand(track, selected, camera);
      assert.deepEqual(demand.required, []); assert.deepEqual(demand.prewarm, []);
      publisher.publish(selected, camera, resources);
      assert.equal(publisher.observe().enabled, false); assert.equal(element.style.backgroundImage, "none");
    }
    assert.equal(reads, before); assert.equal(selected.enabled, true, "zoom must not alter the user's atmosphere setting");
    publisher.publish(selected, globe, resources); assert.match(element.style.backgroundImage, /earth-atmosphere-row/);
    assert.equal(publisher.observe().enabled, true);
    assert.deepEqual(resolvePreparedMaterialDemand(track, { ...selected, enabled: false }, globe).required, []);
  } finally { f.restore(); }
});

test("every object's visible, hidden and fixed materials use the same resource rule", () => {
  for (const definition of definitions) for (const variant of definition.variants) for (const selected of variant.materials) {
    const track = definition.materials.find(track => track.id === selected.track);
    for (const z of [-1, -.5, 0, .5, 1]) {
      const camera = view(z), state = preparedMaterialState(track, selected, camera);
      const demand = resolvePreparedMaterialDemand(track, selected, camera);
      assert.deepEqual(demand.required, selected.enabled && state.address?.resource != null ? [state.address.resource] : [], definition.id);
      assert.ok(demand.prewarm.every(key => !demand.required.includes(key)));
      assert.deepEqual(resolvePreparedMaterialDemand(track, { ...selected, enabled: false }, camera).required, []);
      assert.deepEqual(resolvePreparedMaterialDemand(track, { ...selected, enabled: false }, camera).prewarm, []);
      assert.deepEqual(resolvePreparedMaterialDemand({ ...track, id: "renamed" }, selected, camera), demand);
      // Request history and control pitch cannot change a light-phase lookup.
      assert.deepEqual(resolvePreparedMaterialDemand(track, selected, { ...camera, controlPitch: 900, controlYaw: -900 }, {},
        { bank: "other", frame: 999, row: 999, rows: [999] }), demand);
      const unavailable = { has: () => false, readyKeys: () => track.banks[0].frames.map(frame => frame.resource) };
      if (state.address?.resource != null) assert.equal(preparedMaterialAddress(track, state, unavailable), null);
    }
  }
});

test("camera roll preserves phase for every material in every object", () => {
  for (const definition of definitions) for (const track of definition.materials) {
    for (const z of [-1, -.8, -.2, 0, .3, .8, 1]) {
      const r = Math.sqrt(1-z*z), expected = preparedMaterialFrame(track.frame, { sunViewDirection: [r, 0, z] });
      for (const degrees of [45, 90, 180, 270]) {
        const a = degrees*Math.PI/180;
        assert.equal(preparedMaterialFrame(track.frame, { sunViewDirection: [r*Math.cos(a), r*Math.sin(a), z] }), expected, definition.id);
      }
    }
  }
});
test("Jupiter source samples cover the entire phase domain without a runtime calibration", () => {
  const track = definitions.find(d => d.id === "jupiter").materials[0];
  assert.equal(lighting.presentations[0].cameraLightDirection[2], -1);
  assert.equal(lighting.presentations.at(-1).cameraLightDirection[2], 1);
  for (const sample of lighting.presentations) {
    assert.equal(preparedMaterialFrame(track.frame, {sunViewDirection: sample.cameraLightDirection}), sample.frameIndex);
  }
});

test("Mars keeps atmosphere phase and ground shadow mode independent across the full bank", () => {
  const definition = definitions.find(d => d.id === "mars"), track = definition.materials[0];
  for (let frame = 0; frame < 256; frame++) for (const shadows of [false, true]) {
    const variant = definition.variants.find(variant => variant.when.lensId === "normal" && variant.when.shadows === shadows);
    const demand = resolvePreparedMaterialDemand(track, variant.materials[0], view(-1+frame*2/255));
    assert.deepEqual(demand.required, [`lighting:${frame+(shadows ? 0 : 256)}`]);
    assert.ok(demand.prewarm.length <= 2);
  }
});

test("prepared default images require the actual reference view, not stale pitch controls", () => {
  for (const definition of definitions) for (const track of definition.materials) {
    const selected = definition.variants.flatMap(v => v.materials).find(s => s.track === track.id && s.mode === "frames" && track.banks.find(b => b.id === s.bank).default);
    if (!selected) continue;
    const reference = { sunViewDirection: [0,0,1], sceneMatrix: "initial" };
    const initial = { ...reference, reference };
    assert.equal(preparedMaterialState(track, selected, initial).mode, "default");
    assert.equal(preparedMaterialState(track, selected, { ...initial, sceneMatrix: "rotated", controlPitch: definition.camera.defaultControlPitchDegrees }).mode, "directional");
  }
});
