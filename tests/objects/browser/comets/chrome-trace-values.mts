import { requireRecord } from '../../../../tools/source-values.mts';
import { shape, optional, text, number, array, boolean } from '../../../../tools/objects/terrestrial-layers/source-records.mts';

const parseFrameReporter = shape({
  state: optional(text), frame_type: optional(text), frame_source: optional(number), frame_sequence: optional(number),
  affects_smoothness: optional(boolean), checkerboarded_needs_raster: optional(boolean), checkerboarded_needs_record: optional(boolean),
  has_missing_content: optional(boolean), has_compositor_animation: optional(boolean), has_main_animation: optional(boolean),
});
const parseEventData = shape({ name: optional(text), url: optional(text), processId: optional(number),
  documentLoaderURL: optional(text), totalElements: optional(number), requestId: optional(text), encodedDataLength: optional(number) });
const parseEventArguments = shape({ name: optional(text), data: optional(parseEventData),
  frame_reporter: optional(parseFrameReporter), totalElements: optional(number) });
export const parseChromeTraceEvent = shape({ name: optional(text), ph: text, ts: number, pid: number, tid: number,
  dur: optional(number), args: optional(parseEventArguments) });
export const parseChromeTrace = shape({ traceEvents: array(parseChromeTraceEvent), metadata: optional(requireRecord) });
export type ChromeTraceEvent = ReturnType<typeof parseChromeTraceEvent>;
export type ChromeFrameReporter = ReturnType<typeof parseFrameReporter>;
export type ChromeDurationEvent = ChromeTraceEvent & { dur: number };
export type ChromePipelineEvent = ChromeTraceEvent & { args: NonNullable<ChromeTraceEvent['args']> & { frame_reporter: ChromeFrameReporter } };
export function hasDuration(event: ChromeTraceEvent): event is ChromeDurationEvent { return event.ph === 'X' && event.dur !== undefined; }
export function hasFrameReporter(event: ChromeTraceEvent): event is ChromePipelineEvent { return event.args?.frame_reporter !== undefined; }
