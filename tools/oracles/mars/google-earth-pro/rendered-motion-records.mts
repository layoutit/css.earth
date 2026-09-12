import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { array, object, text, finite, integer, boolean, numbers } from './oracle-values.mts';
import { browserState, cameraMatrix } from './interaction-analysis-records.mts';

const optionalNumber = (value: unknown) => value == null ? undefined : finite(value);
const optionalText = (value: unknown) => value == null ? undefined : text(value);
export function parseCrop(value: unknown) {
  const row = object(value);
  return { left: integer(row.left), top: integer(row.top), width: integer(row.width), height: integer(row.height) };
}
export function parseRenderedNativeReport(value: unknown) {
  const row = object(value), viewport = object(row.viewport);
  return { ...row, stopObservation: row.stopObservation, calibrationSha256: text(row.calibrationSha256), revision: optionalNumber(row.revision),
    captureConfiguration: row.captureConfiguration == null ? undefined : {
      captureUntilRest: object(row.captureConfiguration).captureUntilRest == null ? undefined : boolean(object(row.captureConfiguration).captureUntilRest) },
    bindings: array(row.bindings).map(value => ({ mapped: boolean(object(value).mapped) })),
    crop: parseCrop(row.crop), viewport: { width: finite(viewport.width), height: finite(viewport.height),
      sceneLeft: finite(viewport.sceneLeft), deviceScaleFactor: finite(viewport.deviceScaleFactor) },
    inputs: array(row.inputs).map(value => { const input = object(value); return { ...input,
      event: text(input.event), revision: optionalNumber(input.revision),
      acceptedMonotonicSeconds: optionalNumber(input.acceptedMonotonicSeconds),
      postedMonotonicSeconds: optionalNumber(input.postedMonotonicSeconds), sourceMonotonicSeconds: optionalNumber(input.sourceMonotonicSeconds) }; }),
    frames: array(row.frames).map(value => { const frame = object(value); return { ...frame,
      index: integer(frame.index), presentIndex: integer(frame.presentIndex), path: text(frame.path), monotonicSeconds: finite(frame.monotonicSeconds) }; }),
    dropped: array(row.dropped), nativeMotionTrace: optionalText(row.nativeMotionTrace) };
}
export interface RenderedBrowserFrame {
  index: number; timestamp: number; path: string; sha256: string;
  nativeIndex?: number; nativePresentIndex?: number; marker?: number; heldInitialFrame?: boolean;
  pose?: { scene: string }; interaction?: { activeMode: string };
}
function browserFrame(value: unknown): RenderedBrowserFrame {
  const row = object(value);
  const scene = row.pose == null ? undefined : text(object(row.pose).scene);
  if (scene !== undefined) cameraMatrix(scene);
  return { ...row, index: integer(row.index), timestamp: finite(row.timestamp), path: text(row.path), sha256: text(row.sha256),
    nativeIndex: optionalNumber(row.nativeIndex), nativePresentIndex: optionalNumber(row.nativePresentIndex),
    marker: optionalNumber(row.marker), heldInitialFrame: row.heldInitialFrame == null ? undefined : boolean(row.heldInitialFrame),
    pose: scene === undefined ? undefined : { scene }, interaction: row.interaction == null ? undefined : { activeMode: text(object(row.interaction).activeMode) } };
}
export function parseRenderedBrowserReport(value: unknown) {
  const row = object(value), cameraOffset = row.cameraOffset == null ? undefined : object(row.cameraOffset);
  return { ...row, stopObservation: row.stopObservation, calibrationSha256: text(row.calibrationSha256), timingMode: optionalText(row.timingMode),
    epoch: finite(row.epoch), frameBinding: optionalText(row.frameBinding), frameClock: optionalText(row.frameClock),
    controlledCadenceHz: optionalNumber(row.controlledCadenceHz), inputTiming: optionalText(row.inputTiming),
    state: browserState(row.state), crop: row.crop == null ? undefined : parseCrop(row.crop),
    cameraOffset: cameraOffset == null ? undefined : { x: finite(cameraOffset.x), y: finite(cameraOffset.y) },
    projectionBinding: row.projectionBinding == null ? undefined : {
      nativeProjection: numbers(object(row.projectionBinding).nativeProjection) }, frames: array(row.frames).map(browserFrame) };
}

export async function loadHeldInitialFrame(browserReportPath: string, epoch: number): Promise<RenderedBrowserFrame> {
  const path = resolve(dirname(browserReportPath), 'initial.png');
  const bytes = await readFile(path);
  return { index: -1, timestamp: epoch / 1000, path,
    sha256: createHash('sha256').update(bytes).digest('hex'), heldInitialFrame: true };
}
