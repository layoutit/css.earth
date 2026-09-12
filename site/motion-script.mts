/** One fixed camera motion through the real input path, so traces of different
 * renderers compare the same work. The motion is a recording of pointer and wheel
 * input on the stage, replayed at its original timing from the stage centre. */
export interface MotionEvent { t: number; type: string; x: number; y: number; buttons?: number; deltaY?: number; deltaMode?: number }
import { MOTION_RECORDING } from './motion-recording.mts';

function surfaceOf(documentTarget: Document, windowTarget: Window & typeof globalThis) {
  const surface = documentTarget.querySelector('.planet-input-surface');
  if (!(surface instanceof windowTarget.HTMLElement)) throw new Error('Motion script needs the input surface.');
  const rect = surface.getBoundingClientRect();
  return { surface, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
}

/** Records input on the stage until stopped; the result is the array the replay hardcodes. */
export function createMotionRecorder(documentTarget: Document, windowTarget: Window & typeof globalThis) {
  const { surface, cx, cy } = surfaceOf(documentTarget, windowTarget);
  const events: MotionEvent[] = [], started = performance.now(), controller = new AbortController();
  const round = (value: number) => Math.round(value * 10) / 10;
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) {
    surface.addEventListener(type, event => {
      if (type === 'pointermove' && event.buttons === 0) return;
      events.push({ t: Math.round(performance.now() - started), type, x: round(event.clientX - cx), y: round(event.clientY - cy), buttons: event.buttons });
    }, { capture: true, signal: controller.signal });
  }
  surface.addEventListener('wheel', event => {
    events.push({ t: Math.round(performance.now() - started), type: 'wheel', x: round(event.clientX - cx), y: round(event.clientY - cy), deltaY: round(event.deltaY), deltaMode: event.deltaMode });
  }, { capture: true, signal: controller.signal });
  return { stop(): MotionEvent[] { controller.abort(); return events; } };
}

export async function runMotionScript(documentTarget: Document, windowTarget: Window & typeof globalThis, recording: readonly MotionEvent[] = MOTION_RECORDING): Promise<void> {
  if (recording.length === 0) throw new Error('No motion recording: press Record, perform the motion, press Stop, and paste the log into site/motion-recording.mts.');
  const { surface, cx, cy } = surfaceOf(documentTarget, windowTarget);
  const dispatch = (event: MotionEvent) => {
    if (event.type === 'wheel') {
      surface.dispatchEvent(new windowTarget.WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx + event.x, clientY: cy + event.y,
        deltaY: event.deltaY ?? 0, deltaMode: event.deltaMode ?? 0 }));
      return;
    }
    surface.dispatchEvent(new windowTarget.PointerEvent(event.type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', isPrimary: true,
      clientX: cx + event.x, clientY: cy + event.y, button: 0, buttons: event.buttons ?? (event.type === 'pointerup' || event.type === 'pointercancel' ? 0 : 1) }));
  };
  // A synthetic pointer has no active id: capture calls for it would throw and
  // abort the scene, so they are inert for the replay's pointer only.
  const capture = { set: surface.setPointerCapture, release: surface.releasePointerCapture, has: surface.hasPointerCapture };
  let captured = false;
  surface.setPointerCapture = function (id: number) { if (id === 7) { captured = true; return; } return capture.set.call(this, id); };
  surface.releasePointerCapture = function (id: number) { if (id === 7) { captured = false; return; } return capture.release.call(this, id); };
  surface.hasPointerCapture = function (id: number) { return id === 7 ? captured : capture.has.call(this, id); };
  const restore = () => { surface.setPointerCapture = capture.set; surface.releasePointerCapture = capture.release; surface.hasPointerCapture = capture.has; };
  const started = performance.now();
  let next = 0;
  await new Promise<void>(resolve => {
    const tick = () => {
      const elapsed = performance.now() - started;
      while (next < recording.length && recording[next]!.t <= elapsed) dispatch(recording[next++]!);
      if (next < recording.length) windowTarget.requestAnimationFrame(tick); else resolve();
    };
    windowTarget.requestAnimationFrame(tick);
  }).finally(restore);
  await new Promise<void>(resolve => windowTarget.setTimeout(resolve, 1500));
}
