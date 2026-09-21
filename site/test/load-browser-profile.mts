import { isObjectBrowserProfile, requireBrowserProfileControls } from "./object-browser-profile.mts";
import assert from "node:assert/strict";
import { authoredObject } from '../../tools/authored-object.mts';
import { requireRecord } from "../../tools/source-values.mts";
import type { ObjectControls } from "../../src/renderers/css/dist/platform/object-contract.js";
import type { BrowserPage, ObjectBrowserProfile } from "./browser-profile-types.mts";

interface BrowserProfileObject {
  readonly id: string;
}

export async function loadPlanetBrowserProfile(planet: BrowserProfileObject): Promise<ObjectBrowserProfile> {
  assert.ok(await authoredObject(planet.id), `${planet.id}: browser profile requires an authored object descriptor`);
  const browserProfile = requireRecord(await import(new URL(`../../tests/objects/browser/${planet.id}/browser-profile.mts`, import.meta.url).href), `${planet.id} browser profile`).browserProfile;
  assert.ok(isObjectBrowserProfile(browserProfile), `${planet.id}: profile must use the common browser-profile factory`);
  const rawControls = requireRecord(await import(new URL(`../../src/objects/${planet.id}/prepared/controls.json`, import.meta.url).href, {with: {type: 'json'}}), `${planet.id} browser controls`).default;
  const controls = requireBrowserProfileControls(rawControls, planet.id);
  assert.deepEqual(browserProfile.objectControls, controls, `${planet.id}: browser profile must use prepared JSON controls`);
  return validatePlanetBrowserProfile(planet, browserProfile, controls);
}

export function validatePlanetBrowserProfile(planet: BrowserProfileObject, browserProfile: ObjectBrowserProfile, objectControls: ObjectControls): ObjectBrowserProfile {
  assert.equal(browserProfile?.id, planet.id,
    `${planet.id}: browser profile identity must match its object package`);
  assert.equal(typeof browserProfile.inputSelector, "string",
    `${planet.id}: browser profile must provide inputSelector`);
  const lensIds = objectControls.lenses?.controls.map(({ id }) => id) ?? [];
  const audit = browserProfile.audit;
  assert.ok(audit && typeof audit === "object",
    `${planet.id}: browser profile must provide audit expectations`);
  assert.ok(audit.preparedAssetPairs === undefined || (Array.isArray(audit.preparedAssetPairs) &&
    audit.preparedAssetPairs.every(({ one, two }) =>
      typeof one === "string" && one.startsWith("/") &&
      typeof two === "string" && two.startsWith("/"))),
  `${planet.id}: browser profile prepared asset pairs must name prepared paths`);
  const race = audit.lensRace;
  const defaultLens = objectControls.lenses?.defaultLens;
  if (lensIds.length > 1) assert.ok(race &&
    [race.defaultId, race.slowId, race.winnerId, race.slowAsset].every(
      (value) => typeof value === "string" && value.length > 0,
    ) &&
    typeof race.preReadyDisabled === "boolean" &&
    race.defaultId === defaultLens &&
    [race.defaultId, race.slowId, race.winnerId].every((id) => lensIds.includes(id)) &&
    race.slowId !== race.defaultId && race.slowId !== race.winnerId &&
    race.slowAsset.startsWith(`/scenes/${planet.id}/`),
  `${planet.id}: browser profile must provide lens race evidence inputs`);
  const retained = audit.retained;
  const retainedLensIds = retained?.lensIds;
  const retainedSpeedClicks = retained?.speedClicks;
  assert.ok(retained &&
    (lensIds.length ? Array.isArray(retainedLensIds) &&
      retainedLensIds.length === lensIds.length &&
      new Set(retainedLensIds).size === lensIds.length &&
      lensIds.every((id) => retainedLensIds.includes(id))
      : retainedLensIds == null || (Array.isArray(retainedLensIds) && retainedLensIds.length === 0)) &&
    (objectControls.settings?.controls.some(({ name }) => name === "speed")
      ? typeof retainedSpeedClicks === "number" && Number.isSafeInteger(retainedSpeedClicks) && retainedSpeedClicks > 0 : true) &&
    Array.isArray(retained.allowedMountSelectors) &&
    retained.allowedMountSelectors.every((selector) =>
      typeof selector === "string" && selector.startsWith(".")),
  `${planet.id}: browser profile must declare retained interaction evidence`);
  return Object.freeze({ ...browserProfile, objectControls });
}

export async function assertRenderedObjectControls(page: BrowserPage, profile: ObjectBrowserProfile): Promise<unknown> {
  const expectedLenses = profile.objectControls.lenses?.controls.map(({ id }) => id) ?? [];
  const objectSettings = profile.objectControls.settings?.controls ?? [];
  const speed = objectSettings.find(({ name, kind }) => name === "speed" && kind === "cycle");
  const shadows = objectSettings.find(({ name, kind }) => name === "shadows" && kind === "toggle");
  const remainingSettings = objectSettings.filter((setting) =>
    setting !== speed && setting !== shadows);
  const expectedSettings = [
    { name: "motion", kind: "toggle" },
    ...(speed ? [{ name: speed.name, kind: speed.kind }] : []),
    ...(shadows ? [{ name: shadows.name, kind: shadows.kind }] : []),
    { name: "minimap", kind: "toggle" }, { name: "surfaceLabels", kind: "toggle" }, { name: "threeDStars", kind: "toggle" },
    { name: "heliosphere", kind: "toggle" }, { name: "illustrationModels", kind: "toggle" },
    ...remainingSettings.map(({ name, kind }) => ({ name, kind })),
  ];
  const actual = await page.evaluate(() => ({
    lensPanelCount: document.querySelectorAll('.planet-lenses nav[aria-label="Datasets"]:has(button[name="dataset"])').length,
    settingsPanelCount: document.querySelectorAll(".planet-settings").length,
    lenses: [...document.querySelectorAll<HTMLButtonElement>('.planet-lenses button[name="dataset"]')].map((button) => button.value),
    // Named controls only, as the object control binding selects them: "Apply settings" submits the form and has no name.
    settings: [...document.querySelectorAll(".planet-settings input[name], .planet-settings button[name]")]
      .map((input) => {
        if (input instanceof HTMLButtonElement) return { name: input.name, kind: input.type === "button" ? "cycle" : "unsupported" };
        if (input instanceof HTMLInputElement) return { name: input.name, kind: input.type === "range" ? "cycle" : input.type === "checkbox" ? "toggle" : "unsupported" };
        return { name: "", kind: "unsupported" };
      }),
  }));
  assert.equal(actual.lensPanelCount, expectedLenses.length ? 1 : 0,
    `${profile.id}: lens panel presence must match supplied content`);
  assert.equal(actual.settingsPanelCount, 1,
    `${profile.id}: shared settings must exist without extra object controls`);
  assert.deepEqual(actual.lenses, expectedLenses, `${profile.id}: exact declared lens controls`);
  assert.deepEqual(actual.settings, expectedSettings, `${profile.id}: exact declared settings controls`);
  return actual;
}
