import type { Vector3 } from "@cssearth/renderer/solar-system/types.ts";
/** Where an object's Sun lies: its direction in the scene frame and in view space at the default camera pose. */
export interface DirectionalSunPresentation {
  schema: string; source: string; sourcePath: string; localDirection: readonly number[]; referenceViewDirection: readonly number[]; qualification: string;
}
export interface PreparedDirectionalSunPlan {
  schema: string; model: string; localDirection: Vector3; referenceViewDirection: Vector3;
  provenance: { source: string; sourcePath: string; qualification: string };
}
export const PREPARED_DIRECTIONAL_SUN_SCHEMA =
  "cssearth-prepared-directional-sun@4";

export const DIRECTIONAL_SUN_PRESENTATION_STANDARD = Object.freeze({
  schema: "cssearth-directional-sun-presentation-standard@2",
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

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function sunShape(input: unknown): input is PreparedDirectionalSunPlan {
  if (!record(input) || !record(input.provenance)) return false;
  const provenance = input.provenance;
  return input.schema === PREPARED_DIRECTIONAL_SUN_SCHEMA && typeof input.model === "string" &&
    unitDirection(input.localDirection) && unitDirection(input.referenceViewDirection) &&
    ["source", "sourcePath", "qualification"].every(key => typeof provenance[key] === "string");
}

export function validateDirectionalSunPlan(input: unknown): PreparedDirectionalSunPlan {
  if (!sunShape(input)) throw new TypeError("Prepared directional Sun is incompatible.");
  return input;
}

export function validateDirectionalSunPresentationStandard(standard: DirectionalSunPresentation) {
  if (standard?.schema !== DIRECTIONAL_SUN_PRESENTATION_STANDARD.schema ||
      typeof standard.source !== "string" || typeof standard.sourcePath !== "string" ||
      typeof standard.qualification !== "string" ||
      !unitDirection(standard.localDirection) || !unitDirection(standard.referenceViewDirection)) {
    throw new TypeError("Directional Sun presentation standard is invalid.");
  }
  return standard;
}

function unitDirection(direction: unknown): direction is Vector3 {
  return Array.isArray(direction) && direction.length === 3 &&
    direction.every(Number.isFinite) &&
    Math.abs(Math.hypot(...direction) - 1) < 1e-9;
}
