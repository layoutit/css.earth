// Pointer input for the free camera. A primary drag that starts on the body
// turns about the vertical and tilts around the body, its surface following the
// pointer; elsewhere it pans. A secondary or shift drag turns and tilts about
// the screen centre. Two touches pinch to zoom, twist to turn and drag together
// vertically to tilt, as map apps do. Every drag grabs the world: it moves the
// way the pointer does. Motion is batched to one camera write per frame. The
// wheel stays with the shared wheel dolly.

export interface FreeCameraInputOptions {
  inputSurface: HTMLElement;
  turnDegreesPerPixel: number;
  onStart(): void;
  onEnd(): void;
  pan(dxPixels: number, dyPixels: number): void;
  /** `aroundBody` pivots on the body's centre, otherwise on the screen centre. */
  turn(degrees: number, aroundBody: boolean): void;
  tilt(degrees: number, aroundBody: boolean): void;
  /** True when a drag starting here grabs the body. */
  hitsBody(clientX: number, clientY: number): boolean;
  /** Degrees per pixel for a drag on the body, so its surface keeps up with the pointer. */
  bodyDegreesPerPixel(): number;
  zoomBy(factor: number): void;
  onError(error: unknown): void;
}

interface Tracked { x: number; y: number; grip: 'pan' | 'screen' | 'body'; degreesPerPixel: number }

export function bindFreeCameraInput({ inputSurface, turnDegreesPerPixel, onStart, onEnd, pan, turn, tilt, hitsBody, bodyDegreesPerPixel, zoomBy, onError }: FreeCameraInputOptions) {
  const view = inputSurface.ownerDocument.defaultView;
  if (!view) throw new Error('Free camera input document has no window.');
  const pointers = new Map<number, Tracked>();
  let enabled = false, active = false, frame: number | null = null;
  let pending = { dx: 0, dy: 0, turn: 0, tilt: 0, zoom: 1, aroundBody: false };
  const guard = <Args extends unknown[]>(callback: (...args: Args) => void) => (...args: Args) => {
    try { callback(...args); } catch (error) { onError(error); }
  };
  const flush = guard(() => {
    frame = null;
    const { dx, dy, turn: degrees, tilt: tiltDegrees, zoom, aroundBody } = pending;
    pending = { dx: 0, dy: 0, turn: 0, tilt: 0, zoom: 1, aroundBody: false };
    if (degrees !== 0) turn(degrees, aroundBody);
    if (tiltDegrees !== 0) tilt(tiltDegrees, aroundBody);
    if (zoom !== 1) zoomBy(zoom);
    if (dx !== 0 || dy !== 0) pan(dx, dy);
  });
  const schedule = () => { if (frame === null) frame = view.requestAnimationFrame(flush); };
  const pair = () => {
    const [a, b] = [...pointers.values()] as [Tracked, Tracked];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, spread: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const end = () => {
    if (!active || pointers.size > 0) return;
    active = false;
    inputSurface.style.cursor = enabled ? 'grab' : '';
    onEnd();
  };
  const onPointerDown = guard((event: PointerEvent) => {
    if (!enabled || pointers.size >= 2 || (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2)) return;
    if (event.pointerType !== 'mouse') event.preventDefault();
    const grip = event.button === 2 || event.shiftKey ? 'screen' : pointers.size === 0 && hitsBody(event.clientX, event.clientY) ? 'body' : 'pan';
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, grip,
      degreesPerPixel: grip === 'body' ? bodyDegreesPerPixel() : turnDegreesPerPixel });
    // A pointer released before its down event is handled cannot be captured; the drag still works uncaptured.
    try { inputSurface.setPointerCapture(event.pointerId); } catch { /* not an active pointer */ }
    if (!active) { active = true; inputSurface.style.cursor = 'grabbing'; onStart(); }
  });
  const onPointerMove = guard((event: PointerEvent) => {
    const tracked = pointers.get(event.pointerId);
    if (!enabled || !tracked) return;
    event.preventDefault();
    if (pointers.size === 2) {
      const before = pair();
      tracked.x = event.clientX; tracked.y = event.clientY;
      const after = pair();
      pending.tilt += (after.y - before.y) * turnDegreesPerPixel;
      if (before.spread > 0 && after.spread > 0) pending.zoom *= after.spread / before.spread;
      let twist = after.angle - before.angle;
      if (twist > Math.PI) twist -= 2 * Math.PI; else if (twist < -Math.PI) twist += 2 * Math.PI;
      pending.turn += twist * 180 / Math.PI;
    } else {
      const dx = event.clientX - tracked.x, dy = event.clientY - tracked.y;
      tracked.x = event.clientX; tracked.y = event.clientY;
      if (tracked.grip === 'pan') { pending.dx += dx; pending.dy += dy; }
      else {
        pending.turn -= dx * tracked.degreesPerPixel; pending.tilt += dy * tracked.degreesPerPixel;
        pending.aroundBody = tracked.grip === 'body';
      }
    }
    schedule();
  });
  const onPointerEnd = guard((event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (inputSurface.hasPointerCapture(event.pointerId)) inputSurface.releasePointerCapture(event.pointerId);
    end();
  });
  const onContextMenu = (event: MouseEvent) => { if (enabled) event.preventDefault(); };
  inputSurface.addEventListener('pointerdown', onPointerDown);
  inputSurface.addEventListener('pointermove', onPointerMove);
  inputSurface.addEventListener('pointerup', onPointerEnd);
  inputSurface.addEventListener('pointercancel', onPointerEnd);
  inputSurface.addEventListener('contextmenu', onContextMenu);
  const release = () => {
    for (const id of pointers.keys()) if (inputSurface.hasPointerCapture(id)) inputSurface.releasePointerCapture(id);
    pointers.clear();
    if (frame !== null) { view.cancelAnimationFrame(frame); frame = null; }
    pending = { dx: 0, dy: 0, turn: 0, tilt: 0, zoom: 1, aroundBody: false };
    end();
  };
  return Object.freeze({
    setEnabled(next: boolean) {
      if (enabled === next) return;
      enabled = next;
      if (!next) release();
      inputSurface.style.cursor = next ? 'grab' : '';
    },
    enabled: () => enabled,
    destroy() {
      release();
      enabled = false;
      inputSurface.style.cursor = '';
      inputSurface.removeEventListener('pointerdown', onPointerDown);
      inputSurface.removeEventListener('pointermove', onPointerMove);
      inputSurface.removeEventListener('pointerup', onPointerEnd);
      inputSurface.removeEventListener('pointercancel', onPointerEnd);
      inputSurface.removeEventListener('contextmenu', onContextMenu);
    },
  });
}
