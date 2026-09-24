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
      lifetime.onDispose(() => inputSurface.removeEventListener(name, guarded));
      inputSurface.addEventListener(name, guarded, options);
    };
    listen("pointerdown", onPointerDown);
    listen("pointermove", onPointerMove);
    listen("pointerup", endPointer);
    listen("pointercancel", endPointer);
    listen("lostpointercapture", endPointer);
    listen("mousedown", onMouseDown);
    listen("dblclick", onDoubleClick);
    listen("wheel", onWheel, { passive: false });
    lifetime.onDispose(() => inputSurface.style.removeProperty("user-select"));
    lifetime.onDispose(() => inputSurface.style.removeProperty("cursor"));
    for (const [target,type] of [[windowTarget,"keydown"],[inputSurface.ownerDocument,"visibilitychange"]] as const) {
      if (!target?.addEventListener || !target?.removeEventListener) continue;
      lifetime.onDispose(() => target.removeEventListener(type,onMotionCommand));
      target.addEventListener(type,onMotionCommand);
    }
}
