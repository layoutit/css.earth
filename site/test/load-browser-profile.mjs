import assert from "node:assert/strict";

const REQUIRED_METHODS = Object.freeze([
  "waitForRuntime",
  "pause",
  "camera",
  "setCamera",
  "bounds",
  "stable",
  "runtimePresent",
  "retainedImages",
  "selectedDensity",
  "selectLens",
  "lens",
  "visibleLens",
  "pressedLens",
  "retainedReport",
]);

export async function loadPlanetBrowserProfile(planet) {
  const profileUrl = new URL(
    `../../src/planets/${planet.id}/test/browser-profile.mjs`,
    import.meta.url,
  );
  const { browserProfile } = await import(profileUrl.href);
  assert.equal(browserProfile?.id, planet.id,
    `${planet.id}: browser profile identity must match its object package`);
  assert.equal(typeof browserProfile.inputSelector, "string",
    `${planet.id}: browser profile must provide inputSelector`);
  for (const method of REQUIRED_METHODS) {
    assert.equal(typeof browserProfile[method], "function",
      `${planet.id}: browser profile must provide ${method}()`);
  }
  assert.ok(browserProfile.audit && typeof browserProfile.audit === "object",
    `${planet.id}: browser profile must provide audit expectations`);
  assert.ok(["outer", "panel", "scene", "shared"].includes(
    browserProfile.audit.finalScope),
  `${planet.id}: browser profile must provide a supported final audit scope`);
  assert.ok(Array.isArray(browserProfile.audit.fullComparisonWidths) &&
    browserProfile.audit.fullComparisonWidths.every(Number.isSafeInteger),
  `${planet.id}: browser profile must provide fullComparisonWidths`);
  assert.ok(Array.isArray(browserProfile.audit.preparedAssetPairs) &&
    browserProfile.audit.preparedAssetPairs.length > 0 &&
    browserProfile.audit.preparedAssetPairs.every(({ one, two }) =>
      typeof one === "string" && one.startsWith("/") &&
      typeof two === "string" && two.startsWith("/")),
  `${planet.id}: browser profile must provide prepared asset pairs`);
  const race = browserProfile.audit.lensRace;
  assert.ok(race &&
    [race.defaultId, race.slowId, race.winnerId, race.slowAsset].every(
      (value) => typeof value === "string" && value.length > 0,
    ) &&
    typeof race.preReadyDisabled === "boolean",
  `${planet.id}: browser profile must provide lens race evidence inputs`);
  const retained = browserProfile.audit.retained;
  assert.ok(retained && Array.isArray(retained.lensIds) &&
    retained.lensIds.includes(race.defaultId) &&
    Number.isSafeInteger(retained.speedClicks) && retained.speedClicks > 0 &&
    Array.isArray(retained.allowedMountSelectors) &&
    retained.allowedMountSelectors.every((selector) =>
      typeof selector === "string" && selector.startsWith(".")),
  `${planet.id}: browser profile must declare retained interaction evidence`);
  return browserProfile;
}
