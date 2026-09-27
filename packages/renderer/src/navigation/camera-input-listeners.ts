import { isSharedInputSurface, bindInputEvent } from './shared-input-surface.js';
import type { SceneLifetime } from "@cssearth/engine";
interface CameraInputListeners { inputSurface: HTMLElement; windowTarget: Window; lifetime: SceneLifetime;
  guardNative<Args extends unknown[], Result>(callback: (...args: Args) => Result): (...args: Args) => Result | undefined;
  onPointerDown(event: PointerEvent): void; onPointerMove(event: PointerEvent): void; endPointer(event: PointerEvent): void;
  onMouseDown(event: MouseEvent): void; onDoubleClick(event: MouseEvent): void; onWheel(event: WheelEvent): void;
  onMotionCommand(event: Event): void;
}
export function bindCameraInputListeners({ inputSurface, windowTarget, lifetime, guardNative,
  onPointerDown, onPointerMove, endPointer, onMouseDown, onDoubleClick, onWheel, onMotionCommand }: CameraInputListeners): void {
    const listen = <K extends keyof HTMLElementEventMap>(name: K, callback: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
      const guarded = guardNative(callback);
      lifetime.onDispose(bindInputEvent(inputSurface, `camera:${name}`, inputSurface, name, guarded, options));
    };
    listen("pointerdown", onPointerDown);
    listen("pointermove", onPointerMove);
    listen("pointerup", endPointer);
    listen("pointercancel", endPointer);
    listen("lostpointercapture", endPointer);
    listen("mousedown", onMouseDown);
    listen("dblclick", onDoubleClick);
    listen("wheel", onWheel, { passive: false });
    if (!isSharedInputSurface(inputSurface)) lifetime.onDispose(() => inputSurface.style.removeProperty("user-select"));
    for (const [target,type] of [[windowTarget,"keydown"],[inputSurface.ownerDocument,"visibilitychange"]] as const) {
      if (!target?.addEventListener || !target?.removeEventListener) continue;
      lifetime.onDispose(bindInputEvent(inputSurface, `camera:${type}`, target, type, onMotionCommand));
    }
}
