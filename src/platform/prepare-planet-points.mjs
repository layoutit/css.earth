import {
  createExposure, toneMapped, pointRadiusPx, DISPLAY_GAMMA,
  POINT_MIN_RADIUS_PX, SKIP_RADIUS_PX,
} from "./star-photometry.mjs";
import { PREPARED_PLANET_POINT_SCHEMA } from "./planet-point-presentation.mjs";

// Galaxio bodies/photometry.ts and pointPhotometry.ts: planets use the
// shared point chain with a 0.25 visibility lift and a 50 px radius ceiling.
// The vault's prepared 60-degree, dark-adapted exposure is shared here;
// the camera can select prepared photometry without deriving source data.
const AU_KILOMETERS = 149597870.7;
const SUN_MAGNITUDE_1AU = -26.74;
const PHASE_FLOOR = 1e-3;
const exposure = createExposure({ fovDegrees: 60, intensityMax: 1, maxRadiusPx: 50 });

export function preparePlanetPoint({ radiusKilometers, geometricAlbedo, heliocentricDistanceAu, kilometersPerUnit }) {
  if (![radiusKilometers, geometricAlbedo, heliocentricDistanceAu, kilometersPerUnit].every((value) => Number.isFinite(value) && value > 0)) {
    throw new TypeError("Planet point preparation needs positive physical inputs.");
  }
  const minimumLogDistance = Math.log10(radiusKilometers / kilometersPerUnit);
  const maximumLogDistance = Math.log10(10000 * AU_KILOMETERS / kilometersPerUnit);
  const distanceCount = 129;
  const phaseCount = 129;
  const logDistanceStep = (maximumLogDistance - minimumLogDistance) / (distanceCount - 1);
  const samples = [];
  for (let distanceIndex = 0; distanceIndex < distanceCount; distanceIndex += 1) {
    const observerDistanceAu = 10 ** (minimumLogDistance + distanceIndex * logDistanceStep) * kilometersPerUnit / AU_KILOMETERS;
    for (let phaseIndex = 0; phaseIndex < phaseCount; phaseIndex += 1) {
      const phase = Math.PI * phaseIndex / (phaseCount - 1);
      const phaseFunction = Math.max(PHASE_FLOOR, (Math.sin(phase) + (Math.PI - phase) * Math.cos(phase)) / Math.PI);
      const magnitude = SUN_MAGNITUDE_1AU - 2.5 * Math.log10(Math.max(geometricAlbedo, 1e-6) * phaseFunction) -
        5 * Math.log10(radiusKilometers / AU_KILOMETERS) + 5 * Math.log10(heliocentricDistanceAu * observerDistanceAu);
      const luminance = Math.min(1, Math.max(0, toneMapped(exposure, magnitude))) ** (1 / DISPLAY_GAMMA);
      samples.push(Number(pointRadiusPx(exposure, magnitude).toFixed(5)), Number(luminance.toFixed(6)), Number(magnitude.toFixed(6)));
    }
  }
  return Object.freeze({
    schema: PREPARED_PLANET_POINT_SCHEMA,
    source: "galaxio bodies/photometry.ts + pointPhotometry.ts; prepared vault exposure",
    exposure: Object.freeze({ fovDegrees: exposure.fovDegrees, adaptationLuminanceCdM2: exposure.adaptationLuminanceCdM2 }),
    policy: Object.freeze({ minimumRadiusPx: POINT_MIN_RADIUS_PX, maximumRadiusPx: 50, skipRadiusPx: SKIP_RADIUS_PX, minimumAlpha: 0.25 }),
    minimumLogDistance, logDistanceStep, distanceCount, phaseCount,
    samples: Object.freeze(samples),
  });
}
