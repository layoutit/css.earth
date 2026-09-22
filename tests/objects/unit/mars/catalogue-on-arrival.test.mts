// A flight's destination holds its first-interaction catalogue load until the camera lands, so a body the camera only
// passes (a flight another navigation replaces) never fetches it.
import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('mars');
import { parseHTML } from "linkedom";
import { createSceneLifetime } from "@cssearth/engine";
import runtimeDefinition from "../../../../src/objects/mars/prepared/runtime.json" with { type: "json" };
import { mountSurfaceFeatureLabels } from "../../../../src/renderers/css/dist/index.js";

function mount() {
  const { window, document } = parseHTML('<div id="scene"><div id="host"></div><div id="target"></div><div id="input"></div></div>');
  const byId = (id: string) => { const element = document.getElementById(id); if (!element) throw new Error(id); return element; };
  const requests: string[] = [];
  const layer = mountSurfaceFeatureLabels({
    host: byId("host"), scene: byId("scene"), target: byId("target"), inputSurface: byId("input"),
    plan: runtimeDefinition.features, objectId: "mars",
    zoomRange: () => ({ minimum: 1, maximum: 2 }), lifetime: createSceneLifetime(), onError: () => {},
    transport: async (url: string) => { requests.push(url); return new Promise<Response>(() => {}); },
  });
  const press = () => window.dispatchEvent(new window.Event("pointerdown"));
  return { layer, requests, press };
}

test("a first interaction loads the catalogue at once when no flight is under way", () => {
  const { requests, press } = mount();
  press();
  assert.equal(requests.length, 1);
});

test("an interaction during a flight loads the catalogue only when the camera lands", () => {
  const { layer, requests, press } = mount();
  layer.setNavigationInFlight?.(true);
  press();
  assert.equal(requests.length, 0, "held while the camera flies");
  layer.setNavigationInFlight?.(false);
  assert.equal(requests.length, 1, "loaded on landing");
});

test("a flight another navigation replaces drops the load it held", () => {
  const { layer, requests, press } = mount();
  layer.setNavigationInFlight?.(true);
  press();
  layer.setNavigationInFlight?.(false, false);
  layer.destroy();
  assert.equal(requests.length, 0);
});

test("after a replaced flight, the next interaction loads as usual", () => {
  const { layer, requests, press } = mount();
  layer.setNavigationInFlight?.(true);
  press();
  layer.setNavigationInFlight?.(false, false);
  press();
  assert.equal(requests.length, 1);
});
