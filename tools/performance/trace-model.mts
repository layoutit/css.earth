import { isRecord } from '../sources/source-values.mts';

// Chrome trace JSON is external input. Analysis joins read an event only after
// its name, timestamp and the optional fields they compare have the JSON types
// Chrome emits. Other event fields stay unknown until a consumer checks them.
export interface TraceEvent {
  readonly name: string;
  readonly ts: number;
  readonly ph?: string;
  readonly dur?: number;
  readonly pid?: number;
  readonly tid?: number;
  readonly id?: unknown;
  readonly args?: Readonly<Record<string, unknown>>;
}
export type CompleteEvent = TraceEvent & { readonly dur: number };
export type JsonRecord = Readonly<Record<string, unknown>>;

const optionalType = (value: unknown, type: 'string' | 'number') => value === undefined || typeof value === type;

/** Events without a string name and numeric timestamp cannot take part in any time-based join. */
export function isTraceEvent(value: unknown): value is TraceEvent {
  return isRecord(value) && typeof value.name === 'string' && typeof value.ts === 'number' &&
    optionalType(value.ph, 'string') && optionalType(value.dur, 'number') && optionalType(value.pid, 'number') &&
    optionalType(value.tid, 'number') && (value.args === undefined || isRecord(value.args));
}

export const hasDuration = (event: TraceEvent): event is CompleteEvent => typeof event.dur === 'number';
export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const recordOf = (value: unknown): JsonRecord | undefined => isRecord(value) ? value : undefined;
export const arrayOf = (value: unknown): readonly unknown[] | undefined => Array.isArray(value) ? value : undefined;
export const isInstantPhase = (phase: string | undefined) => phase === 'I' || phase === 'i' || phase === 'R';
/** Chrome stores event payloads in args.data, or args.beginData for begin/end pairs. */
export function dataOf(event: TraceEvent): JsonRecord {
  const value = event.args?.data ?? event.args?.beginData;
  return recordOf(value) ?? {};
}
/** The message of a thrown value, when it has one; mirrors reading `error.message`. */
export const errorMessage = (error: unknown): unknown => isRecord(error) ? error.message : undefined;
export const errorCode = (error: unknown): unknown => isRecord(error) ? error.code : undefined;
/** Later report stages require sections added by earlier stages. */
export function present<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) throw new Error(`Trace brief is missing ${label}.`);
  return value;
}

export interface TraceSelection { readonly rendererPid: number; readonly rendererMainTid: number }
export interface TraceWindowBounds { readonly startTs: number; readonly endTs: number }
export interface TraceWindow extends TraceWindowBounds { readonly durationMs: number }
export interface TimelineFrame {
  readonly index: number; readonly startMs: number; readonly endMs: number; readonly intervalMs: number; readonly mainBusyMs: number;
}

/**
 * A trace or source-map call location. Values copied from trace JSON are checked where they are read.
 * Source-map lookup writes `original` as an OriginalLocation, but a location copied from a trace
 * payload may already carry any value under that key, so readers check it.
 */
export interface TraceLocation {
  url?: unknown; functionName?: unknown; lineNumber?: unknown; columnNumber?: unknown;
  original?: unknown;
}
export interface OriginalLocation {
  source: string; line: number; column: number; name?: string | undefined;
  sourceContentSha256: string | null; excerpt: string | null;
}
