import { requireBoolean as boolean, requireFiniteNumber as finite } from "@cssearth/core";
import { GOOGLE_MAPS_VENUS_URL, ORACLE_POSES, ORACLE_VIEWPORT, parseGoogleCameraUrl } from "./profile.mts";

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return Object.fromEntries(Object.entries(value));
}
export function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a nonempty string.`);
  return value;
}
export function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return Array.from<unknown>(value);
}
function nonnegativeInteger(value: unknown, label: string): number {
  const result = finite(value, label);
  if (!Number.isSafeInteger(result) || result < 0) throw new TypeError(`${label} must be a nonnegative integer.`);
  return result;
}

export function parseReferenceInput(value: unknown) {
  const input = record(value, "Reference packet");
  if (input.schema !== "cssvenus-google-maps-reference-input@3" || input.canonicalUrl !== GOOGLE_MAPS_VENUS_URL) {
    throw new TypeError("Google Maps reference input packet is incompatible.");
  }
  const viewport = record(input.viewport, "Reference viewport");
  if (viewport.width !== ORACLE_VIEWPORT.width || viewport.height !== ORACLE_VIEWPORT.height || viewport.dpr !== ORACLE_VIEWPORT.deviceScaleFactor) {
    throw new Error("Google Maps reference input viewport is not canonical.");
  }
  const poses = array(input.poses, "Reference poses").map((value) => {
    const source = record(value, "Reference pose");
    const id = text(source.id, "Pose id");
    const expected = ORACLE_POSES.find((pose) => pose.id === id);
    if (!expected) throw new TypeError(`Unexpected reference pose ${id}.`);
    if (JSON.stringify(source.actions) !== JSON.stringify(expected.googleActions)) throw new Error(`Reference input actions changed for pose ${id}.`);
    const requestedUrl = text(source.requestedUrl, "Requested URL");
    const finalUrl = text(source.finalUrl, "Final URL");
    parseGoogleCameraUrl(requestedUrl);
    parseGoogleCameraUrl(finalUrl);
    const sha256 = text(source.sha256, "Capture hash");
    if (!/^[a-f0-9]{64}$/u.test(sha256)) throw new TypeError("Capture hash must be SHA-256.");
    const stability = record(source.stability, "Capture stability");
    const comparisons = array(stability.comparisons, "Stability comparisons").map((entry) => {
      const ratio = finite(entry, "Changed pixel ratio");
      if (ratio < 0 || ratio > 1) throw new TypeError("Changed pixel ratio must be in [0, 1].");
      return ratio;
    });
    return { id, actions: expected.googleActions, requestedUrl, finalUrl,
      path: text(source.path, "Capture path"), sha256, attribution: source.attribution,
      stability: { attempts: nonnegativeInteger(stability.attempts, "Capture attempts"), comparisons,
        exactConsecutive: boolean(stability.exactConsecutive, "Consecutive equality") } };
  });
  if (new Set(poses.map(({ id }) => id)).size !== poses.length) throw new TypeError("Duplicate reference pose ids.");
  for (const pose of ORACLE_POSES) if (!poses.some(({ id }) => id === pose.id)) throw new Error(`Reference input is missing pose ${pose.id}.`);
  return { capturedAt: text(input.capturedAt, "Capture timestamp"), browser: record(input.browser, "Reference browser"),
    referenceAssetObservation: input.referenceAssetObservation, exploratorySunSearch: input.exploratorySunSearch, poses };
}

export function parseCalibrationSampleIds(value: unknown): string[] {
  const report = record(value, "Calibration report");
  const components = record(report.components, "Calibration components");
  const starfield = record(components.starfield, "Starfield component");
  const ids = array(starfield.samples, "Starfield samples").map((sample) => {
    const id = text(record(sample, "Starfield sample").id, "Starfield sample id");
    if (!/^[a-zA-Z0-9_-]+$/u.test(id)) throw new TypeError("Unsafe starfield sample id.");
    return id;
  });
  if (ids.length === 0 || new Set(ids).size !== ids.length) throw new TypeError("Calibration samples must be nonempty and unique.");
  return ids;
}
