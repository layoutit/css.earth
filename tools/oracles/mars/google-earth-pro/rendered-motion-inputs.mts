import { object, array, text, finite, boolean, integer } from "./oracle-values.mts";
import { parseInteractionEvent, type InteractionEvent } from "./interaction-corpus.mts";
import type { ViewInfo } from "./controller.mts";

export interface NativeGesture {
  id: string; kind: string; atMilliseconds: number; x: number; y: number;
  button?: number; clickCount?: number; deltaY?: number;
  qtMouseTarget?: string; qtWheelTarget?: string; qtX?: number; qtY?: number; qtDelta?: number; qtButtons?: number;
}
export interface RenderedMotionScenario {
  id?: string; seedAudit?: string; renderHook?: string; captureMilliseconds?: number; captureSize?: number;
  presentHz?: number; untilNativeStops?: boolean; synchronousReadback?: boolean; normalizeStart?: boolean;
  singleWarmup?: boolean; warmCases?: boolean; pointerTransport?: string;
  startCamera?: Partial<ViewInfo>; gesture?: NativeGesture[]; events?: readonly InteractionEvent[];
  cases?: { id: string; startCamera?: Partial<ViewInfo>; gesture: NativeGesture[] }[];
}
export function parseNativeGesture(value: unknown): NativeGesture {
  const entry = object(value, "native gesture");
  const kind = text(entry.kind, "gesture.kind");
  if (!["move", "down", "drag", "up", "wheel"].includes(kind)) throw new TypeError(`Unknown native gesture kind: ${kind}`);
  return { ...entry, id: text(entry.id), kind, atMilliseconds: finite(entry.atMilliseconds), x: finite(entry.x), y: finite(entry.y),
    button: optionalNumber(entry.button), clickCount: optionalNumber(entry.clickCount), deltaY: optionalNumber(entry.deltaY),
    qtMouseTarget: optionalText(entry.qtMouseTarget), qtWheelTarget: optionalText(entry.qtWheelTarget),
    qtX: optionalNumber(entry.qtX), qtY: optionalNumber(entry.qtY), qtDelta: optionalNumber(entry.qtDelta), qtButtons: optionalNumber(entry.qtButtons),
  };
}
export function parseRenderedMotionScenario(value: unknown): RenderedMotionScenario {
  const entry = object(value, "rendered motion scenario");
  return { ...entry,
    id: optionalText(entry.id), seedAudit: optionalText(entry.seedAudit), renderHook: optionalText(entry.renderHook), pointerTransport: optionalText(entry.pointerTransport),
    captureMilliseconds: optionalNumber(entry.captureMilliseconds), captureSize: optionalNumber(entry.captureSize), presentHz: optionalNumber(entry.presentHz),
    untilNativeStops: optionalBoolean(entry.untilNativeStops), synchronousReadback: optionalBoolean(entry.synchronousReadback),
    normalizeStart: optionalBoolean(entry.normalizeStart), singleWarmup: optionalBoolean(entry.singleWarmup), warmCases: optionalBoolean(entry.warmCases),
    startCamera: entry.startCamera === undefined ? undefined : parsePartialView(entry.startCamera),
    events: entry.events === undefined ? undefined : array(entry.events).map(parseInteractionEvent),
    gesture: entry.gesture === undefined ? undefined : array(entry.gesture).map(parseNativeGesture),
    cases: entry.cases === undefined ? undefined : array(entry.cases).map(value => {
      const entry = object(value, "extra motion case");
      return { id: text(entry.id), startCamera: entry.startCamera === undefined ? undefined : parsePartialView(entry.startCamera), gesture: array(entry.gesture).map(parseNativeGesture) };
    }),
  };
}
function parsePartialView(value: unknown): Partial<ViewInfo> {
  const entry = object(value, "startCamera");
  return Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, finite(value, `camera.${key}`)]));
}
export interface NativeCaptureEvent extends Record<string, unknown> {
  event: string; id?: string; kind?: string; loaded?: boolean; revision?: number; acceptedInputSerial?: number; acceptedMonotonicSeconds?: number;
}
export function parseNativeCaptureEvent(value: unknown): NativeCaptureEvent {
  const entry = object(value, "native capture event");
  return { ...entry, event: text(entry.event), id: optionalText(entry.id), kind: optionalText(entry.kind), loaded: optionalBoolean(entry.loaded),
    revision: optionalNumber(entry.revision), acceptedInputSerial: optionalNumber(entry.acceptedInputSerial), acceptedMonotonicSeconds: optionalNumber(entry.acceptedMonotonicSeconds),
  };
}
export interface RenderedFrame extends NativeCaptureEvent {
  revision: number; presentIndex: number; monotonicSeconds: number; path: string; width: number; height: number;
}
export function parseRenderedFrame(value: unknown): RenderedFrame {
  const entry = parseNativeCaptureEvent(value);
  return { ...entry, revision: integer(entry.revision), presentIndex: integer(entry.presentIndex), monotonicSeconds: finite(entry.monotonicSeconds), path: text(entry.path), width: integer(entry.width), height: integer(entry.height) };
}
function optionalNumber(value: unknown): number | undefined { return value === undefined ? undefined : finite(value); }
function optionalText(value: unknown): string | undefined { return value === undefined ? undefined : text(value); }
function optionalBoolean(value: unknown): boolean | undefined { return value === undefined ? undefined : boolean(value); }
