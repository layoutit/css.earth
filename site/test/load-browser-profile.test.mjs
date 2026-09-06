import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../objects.mjs";
import { assertRenderedObjectControls, loadPlanetBrowserProfile, validatePlanetBrowserProfile } from "./load-browser-profile.mjs";

const object = Object.freeze({ id: "fixture" });
const emptyControls = Object.freeze({ lenses: null, settings: null });
const populatedControls = Object.freeze({
  lenses: { defaultLens: "normal", controls: [{ id: "normal" }, { id: "alternate" }] },
  settings: { controls: [{ name: "speed", kind: "cycle", label: "Speed", state: "normal" },
    { name: "shadows", kind: "toggle", label: "Shadows", checked: false }] },
});

function profile(withLenses = false) {
  const noop = () => {};
  return {
    id: "fixture", inputSelector: ".fixture-input",
    waitForRuntime: noop, pause: noop, camera: noop, setCamera: noop,
    bounds: noop, stable: noop, runtimePresent: noop, retainedImages: noop,
    selectedDensity: noop, retainedReport: noop,
    ...(withLenses ? { selectLens: noop, lens: noop, visibleLens: noop, pressedLens: noop } : {}),
    audit: {
      finalScope: "shared", fullComparisonWidths: [390, 1200],
      preparedAssetPairs: [{ one: "/scenes/fixture/a", two: "/scenes/fixture/a2" }],
      ...(withLenses ? { lensRace: { defaultId: "normal", slowId: "alternate", winnerId: "normal",
        slowAsset: "/scenes/fixture/alternate", preReadyDisabled: true } } : {}),
      retained: { allowedMountSelectors: [], ...(withLenses ? { lensIds: ["normal", "alternate"], speedClicks: 5 } : {}) },
    },
  };
}

const sharedSettings = Object.freeze([{ name: "motion", kind: "toggle" }, { name: "skyContrast", kind: "toggle" }]);
function snapshot(controls = emptyControls) {
  const objectSettings = controls.settings?.controls ?? [];
  const speed = objectSettings.find(({ name }) => name === "speed");
  const shadows = objectSettings.find(({ name }) => name === "shadows");
  const remaining = objectSettings.filter((setting) =>
    setting !== speed && setting !== shadows);
  return {
    geographicSlots: 0, lensPanelCount: controls.lenses?.controls.length ? 1 : 0,
    settingsPanelCount: 1,
    lenses: controls.lenses?.controls.map(({ id }) => id) ?? [],
    settings: [sharedSettings[0],
      ...(speed ? [{ name: speed.name, kind: speed.kind }] : []),
      ...(shadows ? [{ name: shadows.name, kind: shadows.kind }] : []),
      sharedSettings[1],
      ...remaining.map(({ name, kind }) => ({ name, kind }))],
  };
}
const page = (value) => ({ evaluate: async () => value });

test("objects without lenses or extra settings retain mandatory browser proof", async () => {
  const validated = validatePlanetBrowserProfile(object, profile(), emptyControls);
  await assertRenderedObjectControls(page(snapshot()), validated);
  for (const method of ["waitForRuntime", "pause", "camera", "setCamera", "bounds", "stable",
    "runtimePresent", "retainedImages", "selectedDensity", "retainedReport"]) {
    assert.throws(() => validatePlanetBrowserProfile(object, { ...profile(), [method]: undefined }, emptyControls),
      new RegExp(`provide ${method}\\(\\)`));
  }
});

test("declared content requires exact lens and setting DOM before optional checks", async () => {
  const validated = validatePlanetBrowserProfile(object, profile(true), populatedControls);
  await assertRenderedObjectControls(page(snapshot(populatedControls)), validated);
  await assert.rejects(assertRenderedObjectControls(page(snapshot()), validated), /lens panel presence/u);
  await assert.rejects(assertRenderedObjectControls(page({ ...snapshot(populatedControls), lenses: ["normal", "wrong"] }), validated), /exact declared lens/u);
  await assert.rejects(assertRenderedObjectControls(page({ ...snapshot(populatedControls), lenses: ["normal", "normal"] }), validated), /exact declared lens/u);
  await assert.rejects(assertRenderedObjectControls(page({ ...snapshot(populatedControls), settings: sharedSettings }), validated), /exact declared settings/u);
  const wrongKind = snapshot(populatedControls);
  wrongKind.settings[1] = { name: "speed", kind: "toggle" };
  await assert.rejects(assertRenderedObjectControls(page(wrongKind), validated), /exact declared settings/u);
});

test("optional controls never excuse a missing shared panel or Motion", async () => {
  const validated = validatePlanetBrowserProfile(object, profile(), emptyControls);
  await assert.rejects(assertRenderedObjectControls(page({ ...snapshot(), settingsPanelCount: 0 }), validated), /shared settings/u);
  await assert.rejects(assertRenderedObjectControls(page({ ...snapshot(), settings: sharedSettings.slice(1) }), validated), /exact declared settings/u);
  await assert.rejects(assertRenderedObjectControls(page({ ...snapshot(), geographicSlots: 0, lensPanelCount: 1 }), validated), /lens panel presence/u);
});

test("declared lenses require their methods, matching race IDs, and complete retained coverage", () => {
  for (const method of ["selectLens", "lens", "visibleLens", "pressedLens"]) {
    assert.throws(() => validatePlanetBrowserProfile(object, { ...profile(true), [method]: undefined }, populatedControls),
      new RegExp(`require ${method}\\(\\)`));
  }
  const wrongRace = profile(true);
  wrongRace.audit.lensRace.slowId = "not-declared";
  assert.throws(() => validatePlanetBrowserProfile(object, wrongRace, populatedControls), /lens race evidence/u);
  const incomplete = profile(true);
  incomplete.audit.retained.lensIds = ["normal", "normal"];
  assert.throws(() => validatePlanetBrowserProfile(object, incomplete, populatedControls), /retained interaction evidence/u);
  const noSpeed = profile(true);
  delete noSpeed.audit.retained.speedClicks;
  assert.throws(() => validatePlanetBrowserProfile(object, noSpeed, populatedControls), /retained interaction evidence/u);
  assert.throws(() => validatePlanetBrowserProfile(object, profile(), undefined), /export its lenses and settings/u);
});

test("a single supplied lens keeps interaction proof without inventing a race", () => {
  const single = { lenses: { defaultLens: "normal", controls: [{ id: "normal" }] }, settings: null };
  const candidate = profile(true);
  delete candidate.audit.lensRace;
  candidate.audit.retained.lensIds = ["normal"];
  delete candidate.audit.retained.speedClicks;
  assert.equal(validatePlanetBrowserProfile(object, candidate, single).objectControls, single);
});

test("all current objects retain their complete lens and speed browser evidence", async () => {
  for (const object of OBJECTS) {
    const current = await loadPlanetBrowserProfile(object);
    assert.ok(current.objectControls.lenses.controls.length > 1, object.id);
    assert.ok(current.objectControls.settings.controls.some(({ name }) => name === "speed"), object.id);
    assert.equal(current.audit.retained.speedClicks, 5, object.id);
    assert.deepEqual(new Set(current.audit.retained.lensIds), new Set(current.objectControls.lenses.controls.map(({ id }) => id)), object.id);
  }
});
