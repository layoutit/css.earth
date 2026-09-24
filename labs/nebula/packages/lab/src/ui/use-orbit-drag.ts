import { useRef, type PointerEvent } from 'react';

interface OrbitView { zoom: number; panX: number; panY: number; yaw: number; pitch: number; locked: boolean }
/** Compiler and joint-fit stages use CSS-pixel panning and the same locked-orbit gesture. */
export function useOrbitDrag<T extends OrbitView>(view: { readonly current: T }, onView: (value: T) => void) {
  const drag = useRef<{ id: number; x: number; y: number; view: T; pan: boolean } | null>(null);
  const end = () => { drag.current = null; };
  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: view.current,
        pan: view.current.locked || event.shiftKey };
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const start = drag.current; if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      onView(start.pan ? { ...start.view, panX: start.view.panX + dx, panY: start.view.panY + dy } :
        { ...start.view, yaw: start.view.yaw + dx * .35, pitch: Math.max(-89, Math.min(89, start.view.pitch - dy * .35)) });
    },
    onPointerUp: end, onPointerCancel: end,
  };
}
