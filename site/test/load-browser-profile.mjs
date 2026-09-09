import { isObjectBrowserProfile } from "./object-browser-profile.mjs";
import assert from "node:assert/strict";
import { authoredObject } from '../../tools/authored-object.mjs';

export async function loadPlanetBrowserProfile(planet) {
  if (await authoredObject(planet.id)) {
    const { browserProfile } = await import(new URL(`../../tests/objects/browser/${planet.id}/browser-profile.mjs`, import.meta.url).href);
    assert.ok(isObjectBrowserProfile(browserProfile), `${planet.id}: profile must use the common browser-profile factory`);
    const { default: controls } = await import(new URL(`../../src/planets/${planet.id}/prepared/controls.json`, import.meta.url).href, {with: {type: 'json'}});
    assert.deepEqual(browserProfile.objectControls, controls, `${planet.id}: browser profile must use prepared JSON controls`);
    return validatePlanetBrowserProfile(planet, browserProfile, controls);
  }
  const { objectControls } = await import(new URL(
    `../../src/planets/${planet.id}/site/control-content.mjs`, import.meta.url,
  ).href);
  const profileUrl = new URL(
    `../../src/planets/${planet.id}/test/browser-profile.mjs`,
    import.meta.url,
  );
  const { browserProfile } = await import(profileUrl.href);
  assert.ok(isObjectBrowserProfile(browserProfile), `${planet.id}: profile must use the common browser-profile factory`);
  assert.equal(browserProfile.objectControls, objectControls, `${planet.id}: profile requires actual control content`);
  return validatePlanetBrowserProfile(planet, browserProfile, objectControls);
}

export function validatePlanetBrowserProfile(planet, browserProfile, objectControls) {
  assert.equal(browserProfile?.id, planet.id,
    `${planet.id}: browser profile identity must match its object package`);
  assert.equal(typeof browserProfile.inputSelector, "string",
    `${planet.id}: browser profile must provide inputSelector`);
  const lensIds = objectControls.lenses?.controls.map(({ id }) => id) ?? [];
  assert.ok(browserProfile.audit && typeof browserProfile.audit === "object",
    `${planet.id}: browser profile must provide audit expectations`);
  assert.ok(Array.isArray(browserProfile.audit.preparedAssetPairs) &&
    browserProfile.audit.preparedAssetPairs.length > 0 &&
    browserProfile.audit.preparedAssetPairs.every(({ one, two }) =>
      typeof one === "string" && one.startsWith("/") &&
      typeof two === "string" && two.startsWith("/")),
  `${planet.id}: browser profile must provide prepared asset pairs`);
  const race = browserProfile.audit.lensRace;
  if (lensIds.length > 1) assert.ok(race &&
    [race.defaultId, race.slowId, race.winnerId, race.slowAsset].every(
      (value) => typeof value === "string" && value.length > 0,
    ) &&
    typeof race.preReadyDisabled === "boolean" &&
    race.defaultId === objectControls.lenses.defaultLens &&
    [race.defaultId, race.slowId, race.winnerId].every((id) => lensIds.includes(id)) &&
    race.slowId !== race.defaultId && race.slowId !== race.winnerId &&
    race.slowAsset.startsWith(`/scenes/${planet.id}/`),
  `${planet.id}: browser profile must provide lens race evidence inputs`);
  const retained = browserProfile.audit.retained;
  assert.ok(retained &&
    (lensIds.length ? Array.isArray(retained.lensIds) &&
      retained.lensIds.length === lensIds.length &&
      new Set(retained.lensIds).size === lensIds.length &&
      lensIds.every((id) => retained.lensIds.includes(id))
      : retained.lensIds == null || (Array.isArray(retained.lensIds) && retained.lensIds.length === 0)) &&
    (objectControls.settings?.controls.some(({ name }) => name === "speed")
      ? Number.isSafeInteger(retained.speedClicks) && retained.speedClicks > 0 : true) &&
    Array.isArray(retained.allowedMountSelectors) &&
    retained.allowedMountSelectors.every((selector) =>
      typeof selector === "string" && selector.startsWith(".")),
  `${planet.id}: browser profile must declare retained interaction evidence`);
  return Object.freeze({ ...browserProfile, objectControls });
}

export async function assertRenderedObjectControls(page, profile) {
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
    { name: "skyContrast", kind: "toggle" },
    { name: "heliosphere", kind: "toggle" }, { name: "asteroidOrbits", kind: "toggle" }, { name: "asteroidLabels", kind: "toggle" },
    ...remainingSettings.map(({ name, kind }) => ({ name, kind })),
  ];
  const actual = await page.evaluate(() => ({
    lensPanelCount: document.querySelectorAll(".planet-lenses").length,
    settingsPanelCount: document.querySelectorAll(".planet-settings").length,
    lenses: [...document.querySelectorAll('.planet-lenses button[name="lens"]')].map((button) => button.value),
    settings: [...document.querySelectorAll(".planet-settings input, .planet-settings button")]
      .map((input) => ({ name: input.name, kind: (input.tagName === "BUTTON" && input.type === "button") ||
        (input.tagName === "INPUT" && input.type === "range")
        ? "cycle" : input.tagName === "INPUT" && input.type === "checkbox" ? "toggle" : "unsupported" })),
  }));
  assert.equal(actual.lensPanelCount, expectedLenses.length ? 1 : 0,
    `${profile.id}: lens panel presence must match supplied content`);
  assert.equal(actual.settingsPanelCount, 1,
    `${profile.id}: shared settings must exist without extra object controls`);
  assert.deepEqual(actual.lenses, expectedLenses, `${profile.id}: exact declared lens controls`);
  assert.deepEqual(actual.settings, expectedSettings, `${profile.id}: exact declared settings controls`);
  return actual;
}
