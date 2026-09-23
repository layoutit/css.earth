import type { ControlsUpdate } from './types.js';

export type WheelInputKind = 'wheel' | 'trackpad';
/** A released wheel gesture keeps its own rate and decays it, the same
 * behaviour as a thrown drag. */
export interface WheelZoomInertia {
  readonly dampingSeconds: number;
  /** The glide ends below this share of the rate it was released with. */
  readonly stopRateRatio: number;
  /** Log-distance per second below which a glide is no longer visible motion and stops. */
  readonly stopLogRatePerSecond: number;
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
  /** How much faster a flight goes when input asks it to hurry. */
  readonly FLIGHT_WHEEL_SPEEDUP: number;
  readonly WHEEL_ZOOM_SPEED_MULTIPLIER: number;
  readonly WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER: number;
  readonly WHEEL_ZOOM_INERTIA: WheelZoomInertia | null;
  /** The input kinds whose released gesture is glided. A precision pointer
   * carries the platform's own momentum, so gliding it again compounds two
   * decays; leaving it out lets that gesture stop with its last event. */
  readonly WHEEL_ZOOM_INERTIA_INPUT_KINDS: readonly WheelInputKind[];
  sceneCursor(state: { surface: boolean; pressed: boolean; enabled: boolean }): string;
  isOrbitDragStart(event: Pick<PointerEvent, 'isPrimary' | 'button'>): boolean;
  wheelZoomInputKind(event: Pick<WheelEvent, 'deltaMode' | 'ctrlKey' | 'deltaX' | 'deltaY' | 'timeStamp'>,
    previousKind?: WheelInputKind | null, previousTimestamp?: number): WheelInputKind;
  bindResponsiveOrbitPolicy(options: ResponsiveOrbitPolicyOptions): { readonly mobile: boolean; destroy(): void };
}
