import { loadInteractionCorpus } from "./interaction-corpus.mjs";

const pointer = (id, kind, atMilliseconds, discX, discY, clickCount = 1) =>
  ({ id, kind, atMilliseconds, discX, discY, button: 0, clickCount });
const camera = { latitude: 0, longitude: 0, distance: 11000000, tilt: 0, azimuth: 0 };

export async function interactionSuiteCases() {
  const corpus = await loadInteractionCorpus();
  return [...corpus.scenarios, {
    id: "regression-sky-drag-crosses-body", set: "regression",
    tags: ["sky-drag", "sky-rim-clamp-and-surface-continuation"], startCamera: camera,
    events: [pointer("sky-down", "down", 0, 1.3, -.3),
      pointer("sky-drag", "drag", 100, 1.15, -.2),
      pointer("cross-body", "drag", 200, .6, 0),
      pointer("inside-body", "drag", 300, -.2, .1),
      pointer("sky-up", "up", 500, -.2, .1)],
  }, {
    id: "regression-held-pointer-wheel-drag", set: "regression",
    tags: ["held-pointer-wheel-drag"], startCamera: camera,
    events: [pointer("hold", "down", 0, 0, 0),
      { id: "held-wheel", kind: "wheel", atMilliseconds: 180, discX: 0, discY: 0, deltaY: 120 },
      pointer("move-after-zoom", "drag", 700, .28, 0),
      pointer("held-up", "up", 1000, .28, 0)],
  }, {
    id: "regression-click-stops-coast", set: "regression",
    tags: ["click-stops-coast"], startCamera: camera,
    events: [pointer("throw-down", "down", 0, -.35, 0),
      pointer("throw-move-1", "drag", 40, -.1, 0),
      pointer("throw-move-2", "drag", 80, .15, 0),
      pointer("throw-up", "up", 120, .4, 0),
      pointer("stop-down", "down", 400, 0, 0),
      pointer("stop-up", "up", 650, 0, 0)],
  }];
}

// Repeat different motion families. These estimate observed run variation;
// they do not turn recorder overhead into a product timing tolerance.
export const repeatabilityCases = [
  "training-baseline-low-horizontal-near",
  "training-wheel-during-fly-to",
  "training-repeated-double-click",
];
