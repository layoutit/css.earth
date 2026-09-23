import type { MotionCompletion } from './types.js';

type FlightFrame = 'presented' | 'idle' | 'complete';
interface Options {
  windowTarget: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame' | 'performance'>;
  signal?: AbortSignal;
  paused?: boolean;
  advance(elapsedS: number, stepS: number): FlightFrame | Promise<FlightFrame>;
  onFinish?(completed: boolean): void;
}

/** One clock and one outstanding camera publication for a flight's entire lifetime. */
export function createCameraFlight({ windowTarget, signal, paused = false, advance, onFinish = () => {} }: Options) {
  const controller = new AbortController();
  let frame: number | null = null, previousTime: number | null = null;
  let elapsedS = 0, speed = 1, settled = false, publishing = false;
  let resolve!: (result: MotionCompletion) => void, reject!: (error: unknown) => void;
  const finished = new Promise<MotionCompletion>((done, fail) => { resolve = done; reject = fail; });
  // Callers can attach completion after an asynchronous scene handoff.
  void finished.catch(() => {});
  function settle(completed: boolean, failure?: { error: unknown }, reason?: unknown) {
    if (settled) return;
    settled = true;
    if (frame !== null) windowTarget.cancelAnimationFrame(frame);
    frame = null;
    signal?.removeEventListener('abort', abort);
    try { onFinish(completed); } catch (error) { failure ??= { error }; }
    if (failure) { controller.abort(failure.error); reject(failure.error); }
    else {
      if (!completed) controller.abort(reason);
      resolve({ completed });
    }
  }
  function cancel(reason: unknown = new DOMException('Camera flight was cancelled.', 'AbortError')) { settle(false, undefined, reason); }
  function fail(error: unknown) { settle(false, { error }); }
  function complete() { settle(true); }
  function abort() { cancel(signal?.reason); }
  function schedule() {
    if (!settled && !paused && !publishing && frame === null) frame = windowTarget.requestAnimationFrame(paint);
  }
  function accept(result: FlightFrame, asynchronous: boolean) {
    publishing = false;
    if (settled) return;
    if (result === 'complete') { complete(); return; }
    // A worker acknowledgement already crossed the presentation rAF. A second
    // admission rAF here would halve cadence. Readiness holds still sleep.
    if (asynchronous && result === 'presented' && !paused) paint(windowTarget.performance.now());
    else schedule();
  }
  function paint(time: number) {
    frame = null;
    if (settled || paused) return;
    const stepS = previousTime === null ? 0 : Math.max(0, time - previousTime) / 1000 * speed;
    previousTime = time;
    elapsedS += stepS;
    try {
      const result = advance(elapsedS, stepS);
      if (typeof result === 'string') accept(result, false);
      else { publishing = true; void result.then(value => accept(value, true), fail); }
    } catch (error) { fail(error); }
  }
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  else schedule();
  return Object.freeze({
    finished, signal: controller.signal, cancel, complete,
    hurry(multiplier: number) { speed = multiplier; },
    /** Hold at the acknowledged curve position while assets catch up. */
    hold(atElapsedS: number) {
      paused = true;
      elapsedS = atElapsedS;
      previousTime = null;
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
    },
    resume() { paused = false; schedule(); },
  });
}
