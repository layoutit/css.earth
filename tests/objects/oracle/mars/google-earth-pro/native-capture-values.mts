import { object, array, text, finite, integer, boolean } from "./oracle-values.mts";
import type { ViewInfo } from "./controller.mts";
export type EventRecord = Record<string, unknown> & { event: string };
export function parseCaptureEvent(value: unknown): EventRecord {
  const entry = object(value, "native event");
  const result: EventRecord = { ...entry, event: text(entry.event, "native event kind") };
  for (const key of ["revision", "acceptedInputSerial", "acceptedMonotonicSeconds", "postedMonotonicSeconds", "requestedMilliseconds", "sourceMonotonicSeconds", "clickCount"]) {
    if (entry[key] !== undefined) result[key] = finite(entry[key], `event.${key}`);
  }
  for (const key of ["id", "kind"]) if (entry[key] !== undefined) result[key] = text(entry[key], `event.${key}`);
  if (entry.delivered !== undefined) result.delivered = boolean(entry.delivered, "event.delivered");
  return result;
}
export function eventNumber(event: EventRecord, key: string): number { return finite(event[key], `event.${key}`); }
export function eventString(event: EventRecord, key: string): string { return text(event[key], `event.${key}`); }
export function parseNativeView(value: unknown): ViewInfo {
  const entry = object(value, "native camera");
  return { latitude: finite(entry.latitude), longitude: finite(entry.longitude), distance: finite(entry.distance), tilt: finite(entry.tilt), azimuth: finite(entry.azimuth) };
}
export function parseLayerManifest(value: unknown) {
  const entry = object(value, "layer manifest"), hook = object(entry.hook, "layer hook");
  return { ...entry, sourceFragmentShaderSha256: text(entry.sourceFragmentShaderSha256), hook: { ...hook, path: text(hook.path) } };
}
export function parseCalibrationManifest(value: unknown) {
  const entry = object(value, "calibration manifest"), source = object(entry.source, "calibration source");
  return { ...entry, source: { ...source, decodedRgbaSha256: text(source.decodedRgbaSha256) } };
}
export function parseNativeRegistration(value: unknown) {
  const entry = object(value, "native registration"), calibration = object(entry.calibration, "native calibration");
  return { ...entry, qualification: text(entry.qualification), calibration: { ...calibration, sourceDecodedRgbaSha256: text(calibration.sourceDecodedRgbaSha256) } };
}
export function parseBrowserRegistration(value: unknown) {
  const entry = object(value, "browser registration"), viewport = object(entry.viewport), crop = object(entry.crop);
  return { ...entry, qualification: text(entry.qualification),
    viewport: { ...viewport, width: integer(viewport.width), height: integer(viewport.height) },
    crop: { ...crop, left: integer(crop.left), top: integer(crop.top), width: integer(crop.width), height: integer(crop.height) },
    densities: array(entry.densities).map((value) => {
      const density = object(value);
      return { ...density, density: finite(density.density), captures: array(density.captures).map((value) => {
        const capture = object(value), disc = object(capture.nativeDisc);
        return { ...capture, nativeCamera: parseNativeView(capture.nativeCamera), nativeDisc: {
          ...disc, centerX: finite(disc.centerX), centerY: finite(disc.centerY), width: finite(disc.width), height: finite(disc.height),
        } };
      }) };
    }),
  };
}
export function parseMapping(value: unknown) {
  const entry = object(value, "calibration mapping");
  return { ...entry, ok: boolean(entry.ok), mappingCount: integer(entry.mappingCount), reportPath: text(entry.reportPath) };
}
export interface CameraCalibration {
  readonly qualification: string; readonly candidateCount: number;
  readonly camera: { readonly latitude: number; readonly longitude: number };
  readonly selectedProbe: { readonly score: { readonly changedPixelRatioAboveTolerance: number } };
  readonly reusedFrom?: { readonly qualification: string; readonly path: string; readonly sha256: string };
}
export function parseCameraCalibration(value: unknown): CameraCalibration {
  const entry = object(object(value, "camera evidence").cameraCalibration, "camera calibration");
  const camera = object(entry.camera), selected = object(entry.selectedProbe), score = object(selected.score);
  return { ...entry, qualification: text(entry.qualification), candidateCount: integer(entry.candidateCount),
    camera: { ...camera, latitude: finite(camera.latitude), longitude: finite(camera.longitude) },
    selectedProbe: { ...selected, score: { ...score, changedPixelRatioAboveTolerance: finite(score.changedPixelRatioAboveTolerance) } } };
}
