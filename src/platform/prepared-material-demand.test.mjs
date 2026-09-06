import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../../site/objects.mjs";
import { preparedMaterialAddress, preparedMaterialFrame, preparedMaterialState } from "./prepared-material.mjs";
import { resolvePreparedMaterialDemand } from "./prepared-material-demand.mjs";
import { PREPARED_JUPITER_LIGHTING as lighting } from "../planets/jupiter/runtime/preparedLighting.mjs";

const definitions = await Promise.all(OBJECTS.map(async ({id}) => (await import(`../planets/${id}/runtime/definition.mjs`)).runtimeDefinition));
const view = z => ({ sunViewDirection: [Math.sqrt(1-z*z), 0, z], sceneMatrix: "moved",
  reference: { sunViewDirection: [0, 0, 1], sceneMatrix: "initial" } });

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

test("Jupiter's prepared source light directions select their actual images through the common phase lookup", () => {
  const track = definitions.find(d => d.id === "jupiter").materials[0];
  const basis = track.frame.lightBasis;
  for (const sample of lighting.presentations) {
    // Inverse of the prepared orthonormal basis is its transpose.
    const direction = sample.cameraLightDirection;
    const sunViewDirection = [0,1,2].map(column => direction.reduce((sum, value, row) => sum+basis[row*3+column]*value, 0));
    assert.equal(preparedMaterialFrame(track.frame, { sunViewDirection, controlPitch: -1234 }), sample.frameIndex);
  }
  const definition = definitions.find(d => d.id === "jupiter");
  const reference = definition.sun.referenceViewDirection.map((value, i) => i ? -value : value);
  assert.equal(preparedMaterialFrame(track.frame, { sunViewDirection: reference }), lighting.transport.defaultFrame);
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
