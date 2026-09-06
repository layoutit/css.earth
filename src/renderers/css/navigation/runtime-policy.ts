import type { ControlsUpdate } from './types.js';

export type WheelInputKind = 'wheel' | 'trackpad';
export interface ResponsiveOrbitPolicyOptions {
  controls: { update(options: ControlsUpdate): void };
  inputSurface: HTMLElement;
  mediaQuery: MediaQueryList;
  onError?: ((error: unknown) => void) | null;
}
/** The application injects its authoritative policy; the engine owns no copy. */
export interface RuntimePolicy {
  readonly MOBILE_VIEWPORT_QUERY: string;
  readonly SKYBOX_DRAG_ENABLED: boolean;
  readonly WHEEL_ZOOM_SPEED_MULTIPLIER: number;
  readonly WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER: number;
  readonly WHEEL_ZOOM_USE_SCROLL_DISTANCE: boolean;
  isOrbitDragStart(event: Pick<PointerEvent, 'isPrimary' | 'button'>): boolean;
  wheelZoomInputKind(event: Pick<WheelEvent, 'deltaMode' | 'ctrlKey' | 'deltaX' | 'deltaY' | 'timeStamp'>,
    previousKind?: WheelInputKind | null, previousTimestamp?: number): WheelInputKind;
  bindResponsiveOrbitPolicy(options: ResponsiveOrbitPolicyOptions): { readonly mobile: boolean; destroy(): void };
}
