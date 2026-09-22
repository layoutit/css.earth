import { parsePreparedObjectRuntime } from '../renderers/css/dist/index.js';
import {parsePhotometricDiscRecipe} from '../../tools/objects/giant-layers/photometric-disc.mts';
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS as OBJECTS } from "../../site/objects.mts";
import { preparedMaterialAddress, preparedMaterialFrame, preparedMaterialState } from '../renderers/css/dist/testing.js';
import { resolvePreparedMaterialDemand } from '../renderers/css/dist/testing.js';
import materialSource from '../objects/jupiter/source/preparation/materials.json' with {type:'json'};
import {prepareNormalizedDiscAddresses} from '../../tools/objects/giant-layers/normalized-disc-presentation.mts';
const lighting=prepareNormalizedDiscAddresses(parsePhotometricDiscRecipe(materialSource));

const definitions = await Promise.all(OBJECTS.map(async ({id}) => parsePreparedObjectRuntime(await loadObjectTestDefinition(id))));
const view = (z: number) => ({ sunViewDirection: [Math.sqrt(1-z*z), 0, z], sceneMatrix: "moved",
  reference: { sunViewDirection: [0, 0, 1], sceneMatrix: "initial" } });

test("every object's visible, hidden and fixed materials use the same resource rule", () => {
  for (const definition of definitions) for (const variant of definition.variants) for (const selected of variant.materials) {
    const track = definition.materials.find(track => track.id === selected.track); assert.ok(track);
    for (const z of [-1, -.5, 0, .5, 1]) {
      const camera = view(z), state = preparedMaterialState(track, selected, camera);
      const demand = resolvePreparedMaterialDemand(track, selected, camera);
      assert.deepEqual(demand.required, selected.enabled && state.address?.resource != null ? [state.address.resource] : [], definition.id);
      assert.ok(demand.prewarm.every(key => !demand.required.includes(key)));
      assert.deepEqual(resolvePreparedMaterialDemand(track, { ...selected, enabled: false }, camera).required, []);
      assert.deepEqual(resolvePreparedMaterialDemand(track, { ...selected, enabled: false }, camera).prewarm, []);
      assert.deepEqual(resolvePreparedMaterialDemand({ ...track, id: "renamed" }, selected, camera), demand);
      // Request history and control pitch cannot change a light-phase lookup.
      assert.deepEqual(Reflect.apply(resolvePreparedMaterialDemand, undefined, [track, selected, { ...camera, controlPitch: 900, controlYaw: -900 }, {},
        { bank: "other", frame: 999, row: 999, rows: [999] }]), demand);
      const unavailable = { has: () => false, read: () => null, url: () => null, readyKeys: () => track.banks[0].frames.flatMap(frame => frame.resource === null ? [] : [frame.resource]) };
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
  const definition = definitions.find(d => d.id === "jupiter"); assert.ok(definition);
  const track = definition.materials[0];
  assert.equal(lighting.presentations[0].cameraLightDirection[2], -1);
  assert.equal(lighting.presentations.at(-1)?.cameraLightDirection[2], 1);
  for (const sample of lighting.presentations) {
    assert.equal(preparedMaterialFrame(track.frame, {sunViewDirection: sample.cameraLightDirection}), sample.frameIndex);
  }
});

test("Mars keeps atmosphere phase and ground shadow mode independent across the full bank", () => {
  const definition = definitions.find(d => d.id === "mars"); assert.ok(definition);
  const track = definition.materials[0];
  for (let frame = 0; frame < 256; frame++) for (const shadows of [false, true]) {
    const variant: (typeof definition.variants)[number] | undefined = definition.variants.find(variant => variant.when.lensId === "normal" && variant.when.shadows === shadows);
    assert.ok(variant);
    const demand = resolvePreparedMaterialDemand(track, variant.materials[0], view(-1+frame*2/255));
    assert.deepEqual(demand.required, [`lighting:${frame+(shadows ? 0 : 256)}`]);
    assert.ok(demand.prewarm.length <= 2);
  }
});

test("prepared default images require the actual reference view, not stale pitch controls", () => {
  for (const definition of definitions) for (const track of definition.materials) {
    const selected = definition.variants.flatMap(v => v.materials).find(s => s.track === track.id && s.mode === "frames" && track.banks.find(b => b.id === s.bank)?.default);
    if (!selected) continue;
    const reference = { sunViewDirection: [0,0,1], sceneMatrix: "initial" };
    const initial = { ...reference, reference };
    assert.equal(preparedMaterialState(track, selected, initial).mode, "default");
    assert.equal(Reflect.apply(preparedMaterialState, undefined, [track, selected, { ...initial, sceneMatrix: "rotated", controlPitch: definition.camera.defaultControlPitchDegrees }]).mode, "directional");
  }
});
