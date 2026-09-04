import { readFile } from "node:fs/promises";

const CORPUS_URL = new URL("./interaction-corpus-v1.json", import.meta.url);

export async function loadInteractionCorpus({ set = "all" } = {}) {
  const corpus = JSON.parse(await readFile(CORPUS_URL, "utf8"));
  const scenarios = set === "all"
    ? corpus.scenarios
    : corpus.scenarios.filter((scenario) => scenario.set === set);
  if (set !== "all" && !["training", "heldout"].includes(set)) {
    throw new TypeError(`Unknown interaction corpus set: ${set}`);
  }
  return Object.freeze({
    ...corpus,
    scenarios: Object.freeze(scenarios.map(freezeScenario)),
  });
}

export function resolveScenarioEvents(scenario, geometry) {
  const { viewport, crop, disc } = geometry;
  const values = [
    viewport?.width,
    viewport?.height,
    crop?.left,
    crop?.top,
    disc?.centerX,
    disc?.centerY,
    disc?.width,
    disc?.height,
  ];
  if (values.some((value) => !Number.isFinite(value)) ||
      viewport.width <= 0 || viewport.height <= 0 ||
      disc.width <= 0 || disc.height <= 0) {
    throw new TypeError("Interaction corpus geometry is invalid.");
  }
  const radiusX = disc.width / 2;
  const radiusY = disc.height / 2;
  return Object.freeze(scenario.events.map((event) => {
    const clientX = crop.left + disc.centerX + event.discX * radiusX;
    const clientY = crop.top + disc.centerY + event.discY * radiusY;
    return Object.freeze({
      ...event,
      clientX,
      clientY,
      normalizedViewportX: clientX / viewport.width,
      normalizedViewportY: clientY / viewport.height,
    });
  }));
}

function freezeScenario(scenario) {
  return Object.freeze({
    ...scenario,
    tags: Object.freeze([...scenario.tags]),
    startCamera: Object.freeze({ ...scenario.startCamera }),
    events: Object.freeze(scenario.events.map((event) =>
      Object.freeze({ ...event }))),
    expectedMeasuredOutputs: Object.freeze([
      ...scenario.expectedMeasuredOutputs,
    ]),
  });
}
