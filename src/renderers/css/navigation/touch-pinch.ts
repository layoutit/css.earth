import type { ControlsUpdate } from './types.js';

interface TouchPinchOptions {
  inputSurface: HTMLElement;
  onStart(): void;
  onScale(scale: number, center: { x: number; y: number }): void;
  onEnd(): void;
  onError(error: unknown): void;
}

/** Two touch points own zoom until both lift; one finger keeps the normal
 * drag/page-scroll policy. Pointer capture never changes CSS touch-action. */
export function createTouchPinchControls({ inputSurface, onStart, onScale, onEnd, onError }: TouchPinchOptions) {
  const pointers = new Map<number, { x: number; y: number }>();
  let enabled = true, disposed = false, claimed = false, active = false;
  let previousSpan: number | null = null;
  const span = () => {
    if (pointers.size !== 2) return null;
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const finish = () => {
    previousSpan = null;
    if (!active) return;
    active = false;
    onEnd();
  };
  const stop = () => {
    const captured = [...pointers.keys()];
    pointers.clear(); claimed = false;
    for (const id of captured) if (inputSurface.hasPointerCapture(id)) inputSurface.releasePointerCapture(id);
    finish();
  };
  const consume = (event: PointerEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const down = (event: PointerEvent) => {
    if (!enabled || event.pointerType !== 'touch' || event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size < 2 && !claimed) return;
    consume(event);
    if (!claimed) {
      claimed = true; active = true;
      // Cancel the first finger's drag before capturing the pinch pair.
      onStart();
      if (disposed || !active) return;
    }
    for (const id of pointers.keys()) inputSurface.setPointerCapture(id);
    previousSpan = span();
  };
  const move = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!claimed) return;
    consume(event);
    const currentSpan = span();
    if (currentSpan && previousSpan && active) {
      const [a, b] = [...pointers.values()];
      onScale(currentSpan / previousSpan, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    previousSpan = currentSpan;
  };
  const end = (event: PointerEvent) => {
    // A drag-to-pinch transfer can release and recapture the same pointer.
    if (event.type === 'lostpointercapture' && inputSurface.hasPointerCapture(event.pointerId)) return;
    if (!pointers.has(event.pointerId)) return;
    if (claimed) consume(event);
    pointers.delete(event.pointerId);
    if (claimed && inputSurface.hasPointerCapture(event.pointerId)) inputSurface.releasePointerCapture(event.pointerId);
    if (pointers.size < 2) finish();
    else previousSpan = span();
    if (pointers.size === 0) claimed = false;
  };
  const listeners = (['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'] as const)
    .map(type => {
      const callback = type === 'pointerdown' ? down : type === 'pointermove' ? move : end;
      const guarded = (event: PointerEvent) => {
        if (disposed) return;
        try { callback(event); } catch (error) { onError(error); }
      };
      return { type, guarded };
    });
  const unbind = () => {
    for (const { type, guarded } of listeners) inputSurface.removeEventListener(type, guarded, { capture: true });
  };
  try {
    for (const { type, guarded } of listeners) inputSurface.addEventListener(type, guarded, { capture: true });
  } catch (error) { unbind(); throw error; }
  return {
    stop,
    update(options: ControlsUpdate) {
      if (options.drag !== undefined) enabled = options.drag;
      if (!enabled) stop();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      unbind();
      stop();
    },
  };
}
