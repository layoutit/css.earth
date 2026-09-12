import type { ControlsUpdate } from './types.js';

export type WheelInputKind = 'wheel' | 'trackpad';
/** A released wheel gesture keeps its own rate and decays it, the same
 * behaviour as a thrown drag. */
export interface WheelZoomInertia {
  readonly dampingSeconds: number;
  /** The glide ends below this share of the rate it was released with. */
  readonly stopRateRatio: number;
  readonly gain: number;
}
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
  readonly WHEEL_ZOOM_INERTIA: WheelZoomInertia | null;
  sceneCursor(state: { surface: boolean; pressed: boolean; enabled: boolean }): string;
  isOrbitDragStart(event: Pick<PointerEvent, 'isPrimary' | 'button'>): boolean;
  wheelZoomInputKind(event: Pick<WheelEvent, 'deltaMode' | 'ctrlKey' | 'deltaX' | 'deltaY' | 'timeStamp'>,
    previousKind?: WheelInputKind | null, previousTimestamp?: number): WheelInputKind;
  bindResponsiveOrbitPolicy(options: ResponsiveOrbitPolicyOptions): { readonly mobile: boolean; destroy(): void };
}
