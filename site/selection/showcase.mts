import type { NavigationIntent } from '../navigation/navigation-request.mts';
import type { BrowserWindow } from '../browser/browser-types.mts';

/** The destinations the Slideshow pill tours: the bodies, nebulae and galaxies with the richest prepared imagery. A tour draws them at random and
 * shows every one before repeating any. */
export const SHOWCASE_OBJECT_IDS: readonly string[] = Object.freeze([
  'sun', 'mercury', 'venus', 'earth', 'moon', 'mars',
  'jupiter', 'io', 'europa', 'ganymede', 'callisto',
  'saturn', 'enceladus', 'titan', 'iapetus',
  'uranus', 'miranda', 'neptune', 'triton',
  'pluto', 'charon', 'ceres', 'vesta', 'bennu', 'ryugu', 'comet-67p',
  'betelgeuse', 'r-doradus', 'pi1-gruis',
  'wasp-39b', 'hd-189733b', 'trappist-1b',
  'm42', 'm8', 'm1', 'helix', 'm2-9', 'm45',
  'lmc', 'smc', 'm31', 'm33', 'm81', 'm83', 'm101', 'ngc-253', 'm87',
]);
/** How long a body stays once its flight has landed, before the tour flies on. */
export const SHOWCASE_DWELL_MS = 7000;
/** How far the camera turns sideways around a body while it stays. */
export const SHOWCASE_TURN_DEGREES = 60;
/** The turn around a galaxy, a cluster or a nebula: each is a picture with little or no depth, and the full turn would show
 * it nearly edge-on. */
export const SHOWCASE_EXTENDED_TURN_DEGREES = 15;

export interface ShowcaseOptions {
  documentTarget: Document;
  windowTarget: BrowserWindow;
  /** The router's navigation: resolves `true` once the flight has landed, anything else when it did not complete. */
  navigate(id: string, intent: NavigationIntent): Promise<boolean | undefined>;
  /** The object whose scene is shown; the tour never flies to it. */
  readObjectId(): string;
  /** Whether the object is a galaxy, a cluster or a nebula, which the camera turns around only a little. */
  isExtended?(id: string): boolean;
  /** Turn the camera sideways around the landed body for its stay. The signal aborts when the tour ends. */
  turn?(options: { degrees: number; durationMilliseconds: number; signal: AbortSignal }): void;
  onError(error: unknown): void;
  ids?: readonly string[];
  dwellMs?: number;
  random?(): number;
}

/** The header's Slideshow pill: a tour of the featured bodies. Pressed, it flies to one, stays while the camera turns
 * around it, and flies to the next, until the reader takes over: a pointer or key on the page, a wheel, Back, the tab leaving
 * the screen, or the pill again. The first hop is a history entry; the rest replace it, so Back returns to the page the tour
 * left. */
export function createShowcaseController({ documentTarget, windowTarget, navigate, readObjectId, isExtended, turn, onError,
  ids = SHOWCASE_OBJECT_IDS, dwellMs = SHOWCASE_DWELL_MS, random = Math.random }: ShowcaseOptions) {
  const button = documentTarget.querySelector<HTMLElement>('.object-showcase-action');
  const events = new AbortController();
  let playing = false, generation = 0, timer: ReturnType<typeof setTimeout> | null = null, bag: string[] = [];
  let tour: AbortController | null = null;
  button?.addEventListener('click', () => { if (playing) stop(); else start(); }, { signal: events.signal });
  function present() {
    const pressed = String(playing);
    if (button && button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
  }
  const takeover = (event: Event) => {
    if (button && event.target instanceof windowTarget.Node && button.contains(event.target)) return;
    stop();
  };
  function start() {
    if (playing) return;
    playing = true;
    tour = new AbortController();
    const { signal } = tour;
    for (const type of ['pointerdown', 'wheel', 'keydown'] as const) documentTarget.addEventListener(type, takeover, { capture: true, passive: true, signal });
    documentTarget.addEventListener('visibilitychange', () => { if (documentTarget.visibilityState === 'hidden') stop(); }, { signal });
    windowTarget.addEventListener('popstate', () => stop(), { signal });
    present();
    void hop(true);
  }
  function stop() {
    if (!playing) return;
    playing = false;
    generation++;
    if (timer !== null) { clearTimeout(timer); timer = null; }
    tour?.abort(); tour = null;
    present();
  }
  function next(): string | null {
    const current = readObjectId();
    let index = bag.findIndex(id => id !== current);
    if (index < 0) {
      bag = [...ids];
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [bag[i], bag[j]] = [bag[j]!, bag[i]!]; }
      index = bag.findIndex(id => id !== current);
    }
    return index < 0 ? null : bag.splice(index, 1)[0]!;
  }
  async function hop(first: boolean) {
    const id = next();
    if (id === null) { stop(); return; }
    const run = generation;
    let landed: boolean | undefined;
    try {
      landed = await navigate(id, { kind: 'object', view: 'body', camera: 'frame', ...(first ? {} : { history: 'replace' as const }) });
    } catch (error) {
      if (run === generation) { stop(); onError(error); }
      return;
    }
    if (run !== generation) return;
    if (landed !== true) { stop(); return; }
    if (tour) turn?.({ degrees: isExtended?.(id) ? SHOWCASE_EXTENDED_TURN_DEGREES : SHOWCASE_TURN_DEGREES, durationMilliseconds: dwellMs, signal: tour.signal });
    timer = setTimeout(() => { timer = null; void hop(false); }, dwellMs);
  }
  return Object.freeze({
    get playing() { return playing; },
    start, stop,
    destroy() { stop(); events.abort(); },
  });
}
