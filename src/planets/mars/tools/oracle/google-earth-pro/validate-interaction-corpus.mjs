import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { browserInteractionScenarios } from
  "../../../../../../site/test/mars-calibration-interaction-driver.mjs";
import { loadInteractionCorpus } from "./interaction-corpus.mjs";
import { nativeInteractionScenarios } from "./native-interaction-driver.mjs";

const corpusPath = new URL("./interaction-corpus-v1.json", import.meta.url);
const corpusBytes = await readFile(corpusPath);
const corpus = await loadInteractionCorpus();

assert.equal(corpus.schema, "cssmars-google-earth-interaction-corpus@1");
assert.equal(corpus.version, 1);
assert.deepEqual(corpus.coordinateContract.range, [-1, 1]);
assert.equal(corpus.coordinateContract.space, "measured-planet-disc");
assert.equal(corpus.timeContract.clock, "scenario-relative-monotonic");
assert.ok(corpus.scenarios.length >= 12);

const ids = new Set();
const requiredOutputFields = Object.freeze([
  "accepted-input-records",
  "frame-camera-matrices",
  "camera-trajectory",
  "settled-endpoint",
  "frame-cadence",
]);
const allowedKinds = new Set(["move", "down", "drag", "up", "wheel"]);
for (const scenario of corpus.scenarios) {
  assert.match(scenario.id, /^(training|heldout)-[a-z0-9-]+$/u);
  assert.ok(!ids.has(scenario.id), `Duplicate scenario id: ${scenario.id}`);
  ids.add(scenario.id);
  assert.ok(["training", "heldout"].includes(scenario.set));
  assert.ok(Array.isArray(scenario.tags) && scenario.tags.length > 0);
  validateCamera(scenario.startCamera, scenario.id);
  assert.ok(Array.isArray(scenario.events) && scenario.events.length > 0);
  let previousOffset = -Infinity;
  const eventIds = new Set();
  for (const event of scenario.events) {
    assert.ok(!eventIds.has(event.id),
      `${scenario.id}: duplicate event id ${event.id}`);
    eventIds.add(event.id);
    assert.ok(allowedKinds.has(event.kind),
      `${scenario.id}: invalid event kind ${event.kind}`);
    assert.ok(Number.isFinite(event.atMilliseconds) &&
      event.atMilliseconds >= 0 && event.atMilliseconds > previousOffset,
    `${scenario.id}: event offsets must be explicit and strictly monotonic`);
    previousOffset = event.atMilliseconds;
    assert.ok(Number.isFinite(event.discX) &&
      event.discX >= -1 && event.discX <= 1);
    assert.ok(Number.isFinite(event.discY) &&
      event.discY >= -1 && event.discY <= 1);
    if (event.kind === "wheel") {
      assert.ok(Number.isFinite(event.deltaY) && event.deltaY !== 0,
        `${scenario.id}: wheel event needs a nonzero deltaY`);
      assert.equal(event.button, undefined);
    } else {
      assert.equal(event.button, 0,
        `${scenario.id}: pointer event needs the explicit primary button`);
      assert.ok(event.clickCount === 1 || event.clickCount === 2,
        `${scenario.id}: pointer event needs clickCount 1 or 2`);
      assert.equal(event.deltaY, undefined);
    }
    for (const forbidden of ["x", "y", "clientX", "clientY",
      "normalizedViewportX", "normalizedViewportY"]) {
      assert.equal(event[forbidden], undefined,
        `${scenario.id}: corpus contains renderer coordinate ${forbidden}`);
    }
  }
  assert.ok(Array.isArray(scenario.expectedMeasuredOutputs));
  for (const field of requiredOutputFields) {
    assert.ok(scenario.expectedMeasuredOutputs.includes(field),
      `${scenario.id}: missing measured output ${field}`);
  }
  assert.ok(scenario.expectedMeasuredOutputs.every((value) =>
    typeof value === "string" && value.length > 0),
  `${scenario.id}: expected outputs must name measurements, not constants`);
}

const training = corpus.scenarios.filter(({ set }) => set === "training");
const heldout = corpus.scenarios.filter(({ set }) => set === "heldout");
const heldOutFraction = heldout.length / corpus.scenarios.length;
assert.equal(training.length, corpus.splitContract.training);
assert.equal(heldout.length, corpus.splitContract.heldOut);
assert.equal(heldOutFraction, corpus.splitContract.heldOutFraction);
assert.ok(heldOutFraction >= 0.25);

const tags = new Set(corpus.scenarios.flatMap(({ tags: values }) => values));
for (const tag of [
  "baseline-drag-release",
  "speed-low",
  "speed-medium",
  "speed-high",
  "horizontal",
  "vertical",
  "diagonal",
  "zoom-near",
  "zoom-default",
  "zoom-far",
  "inertia-interrupted-by-wheel",
  "fly-to-interrupted-by-threshold-drag",
  "repeated-double-click",
  "wheel-during-fly-to",
  "drag-during-inertia",
]) {
  assert.ok(tags.has(tag), `Corpus does not cover ${tag}`);
}

const geometry = Object.freeze({
  viewport: Object.freeze({ width: 1408, height: 959 }),
  crop: Object.freeze({ left: 0, top: 80 }),
  disc: Object.freeze({
    centerX: 705,
    centerY: 399,
    width: 589,
    height: 589,
  }),
});
const geometryFor = () => geometry;
const [native, browser] = await Promise.all([
  nativeInteractionScenarios({ set: "all", geometryFor }),
  browserInteractionScenarios({ set: "all", geometryFor }),
]);
assert.equal(native.length, corpus.scenarios.length);
assert.equal(browser.length, corpus.scenarios.length);
for (let scenarioIndex = 0; scenarioIndex < native.length;
  scenarioIndex += 1) {
  const nativeScenario = native[scenarioIndex];
  const browserScenario = browser[scenarioIndex];
  assert.equal(nativeScenario.scenario.id, browserScenario.scenario.id);
  assert.deepEqual(
    nativeScenario.scenario.startCamera,
    browserScenario.scenario.startCamera,
  );
  assert.equal(nativeScenario.events.length, browserScenario.events.length);
  for (let eventIndex = 0; eventIndex < nativeScenario.events.length;
    eventIndex += 1) {
    const nativeEvent = nativeScenario.events[eventIndex];
    const browserEvent = browserScenario.events[eventIndex];
    for (const field of ["id", "kind", "atMilliseconds", "button",
      "clickCount", "deltaY"]) {
      assert.equal(nativeEvent[field], browserEvent[field],
        `${nativeScenario.scenario.id}: ${field} changed between drivers`);
    }
    assert.ok(Math.abs(nativeEvent.x * geometry.viewport.width -
      browserEvent.x) < 1e-9);
    assert.ok(Math.abs(nativeEvent.y * geometry.viewport.height -
      browserEvent.y) < 1e-9);
    assert.ok(nativeEvent.x >= 0 && nativeEvent.x <= 1);
    assert.ok(nativeEvent.y >= 0 && nativeEvent.y <= 1);
  }
}

process.stdout.write(`${JSON.stringify({
  qualification: "INTERACTION_CORPUS_V1_QUALIFIED",
  corpusPath: corpusPath.pathname,
  corpusSha256: createHash("sha256").update(corpusBytes).digest("hex"),
  scenarioCount: corpus.scenarios.length,
  trainingCount: training.length,
  heldoutCount: heldout.length,
  heldOutFraction,
  explicitEventCount: corpus.scenarios.reduce((sum, scenario) =>
    sum + scenario.events.length, 0),
  coordinateSpace: corpus.coordinateContract.space,
  nativeAndBrowserTimingIntentIdentical: true,
}, null, 2)}\n`);

function validateCamera(camera, id) {
  for (const field of ["latitude", "longitude", "distance", "tilt",
    "azimuth"]) {
    assert.ok(Number.isFinite(camera?.[field]),
      `${id}: invalid start camera ${field}`);
  }
  assert.ok(camera.latitude >= -90 && camera.latitude <= 90);
  assert.ok(camera.longitude >= -180 && camera.longitude <= 180);
  assert.ok(camera.distance > 0);
}
