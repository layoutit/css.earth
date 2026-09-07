import type { PreparedPointFieldSelection } from '@cssearth/engine';
import type { PreparedCssPointField } from './types.js';
import type { PointFieldView } from './point-field-selection.js';

export interface PointFieldWorker {
  onmessage: ((event: MessageEvent<{ ready?: true; id?: number; selection?: PreparedPointFieldSelection; error?: string }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(value: unknown): void;
  terminate(): void;
}
export function samePointFieldView(a: PointFieldView, b: PointFieldView): boolean {
  return a.focalPx === b.focalPx && a.viewportHalfWidthPx === b.viewportHalfWidthPx &&
    a.viewportHalfHeightPx === b.viewportHalfHeightPx &&
    a.eyeUnits.every((value, axis) => value === b.eyeUnits[axis]) &&
    a.viewRotation.every((value, axis) => value === b.viewRotation[axis]);
}

/** A persistent worker with one in-flight view and one replaceable latest view, never a frame backlog. */
export function createPointFieldSelectionClient(payload: PreparedCssPointField,
  receive: (selection: PreparedPointFieldSelection) => void,
  fail: (error: Error) => void,
  createWorker: () => PointFieldWorker = () => new Worker(new URL('./point-field-selection-worker.js', import.meta.url),
    { type: 'module', name: 'cssearth-point-selection' })) {
  const worker = createWorker();
  let ready = false, destroyed = false, sequence = 0;
  let pending: PointFieldView | null = null;
  let inFlight: { id: number; view: PointFieldView } | null = null;
  let completed: PointFieldView | null = null;
  const pump = () => {
    if (!ready || destroyed || inFlight || !pending) return;
    if (completed && samePointFieldView(completed, pending)) { pending = null; return; }
    inFlight = { id: ++sequence, view: pending }; pending = null;
    worker.postMessage(inFlight);
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true; pending = null; inFlight = null;
    worker.onmessage = null; worker.onerror = null; worker.terminate();
  };
  worker.onmessage = ({ data }) => {
    if (destroyed) return;
    if (data.error !== undefined) { destroy(); fail(new Error(data.error)); return; }
    if (data.ready) { ready = true; pump(); return; }
    if (!inFlight || data.id !== inFlight.id) return;
    completed = inFlight.view; inFlight = null;
    if (data.selection) receive(data.selection);
    pump();
  };
  worker.onerror = event => { destroy(); fail(new Error(event.message)); };
  worker.postMessage({ payload });
  return { request(view: PointFieldView) {
    if (destroyed) return;
    pending = view; pump();
  }, destroy };
}
