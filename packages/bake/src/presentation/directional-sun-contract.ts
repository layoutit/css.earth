import { DIRECTIONAL_SUN_PRESENTATION_STANDARD_SCHEMA } from '@cssearth/objects';

/** Where an object's Sun lies: its direction in the scene frame and in view space at the default camera pose. */
export interface DirectionalSunPresentation {
  schema: string; source: string; sourcePath: string; localDirection: readonly number[]; referenceViewDirection: readonly number[]; qualification: string;
}

export const DIRECTIONAL_SUN_PRESENTATION_STANDARD = Object.freeze({
  schema: DIRECTIONAL_SUN_PRESENTATION_STANDARD_SCHEMA,
  source: "Google Earth Pro Mars native Sun contract-derived visual standard",
  sourcePath:
    "src/objects/mars/source/sky/google-earth-pro-contract.json",
  localDirection: Object.freeze([
    0.888810066045983,
    0.13368164386698683,
    0.43834448164469403,
  ]),
  referenceViewDirection: Object.freeze([
    -0.22665800735781816,
    0.13368726790267435,
    -0.964755856215085,
  ]),
  qualification:
    "The Mars-derived Sun direction and camera-relative motion are shared as " +
    "a cssEarth presentation standard; no per-object native Sun position or " +
    "ephemeris is claimed.",
});

export function validateDirectionalSunPresentationStandard(standard: DirectionalSunPresentation) {
  if (standard?.schema !== DIRECTIONAL_SUN_PRESENTATION_STANDARD.schema ||
      typeof standard.source !== "string" || typeof standard.sourcePath !== "string" ||
      typeof standard.qualification !== "string" ||
      !unitDirection(standard.localDirection) || !unitDirection(standard.referenceViewDirection)) {
    throw new TypeError("Directional Sun presentation standard is invalid.");
  }
  return standard;
}

function unitDirection(direction: unknown): direction is readonly number[] {
  return Array.isArray(direction) && direction.length === 3 &&
    direction.every(Number.isFinite) &&
    Math.abs(Math.hypot(...direction) - 1) < 1e-9;
}
