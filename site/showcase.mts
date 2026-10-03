import type { NavigationIntent } from './navigation/navigation-request.mts';
import type { BrowserWindow } from './browser/browser-types.mts';

/** The destinations the Showcase pill tours: the bodies with the richest prepared imagery. A tour draws them at random and
 * shows every one before repeating any. */
export const SHOWCASE_OBJECT_IDS: readonly string[] = Object.freeze([
  'sun', 'mercury', 'venus', 'earth', 'moon', 'mars',
  'jupiter', 'io', 'europa', 'ganymede', 'callisto',
  'saturn', 'enceladus', 'titan', 'iapetus',
  'uranus', 'miranda', 'neptune', 'triton',
  'pluto', 'charon', 'ceres', 'vesta', 'bennu', 'ryugu', 'comet-67p',
  'betelgeuse', 'r-doradus', 'pi1-gruis',
  'wasp-39b', 'hd-189733b', 'trappist-1b',
]);
/** How long a body stays once its flight has landed, before the tour flies on. */
export const SHOWCASE_DWELL_MS = 7000;

export interface ShowcaseOptions {
  documentTarget: Document;
  windowTarget: BrowserWindow;
  /** The router's navigation: resolves `true` once the flight has landed, anything else when it did not complete. */
  navigate(id: string, intent: NavigationIntent): Promise<boolean | undefined>;
  /** The object whose scene is shown; the tour never flies to it. */
  readObjectId(): string;
  onError(error: unknown): void;
  ids?: readonly string[];
  dwellMs?: number;
  random?(): number;
}

/** The header's Showcase pill: a slideshow of the featured bodies. Pressed, it flies to one, dwells, and flies to the next,
 * until the reader takes over: a pointer or key on the page, a wheel, Back, the tab leaving the screen, or the pill again.
 * The first hop is a history entry; the rest replace it, so Back returns to the page the tour left. */
export function createShowcaseController({ documentTarget, windowTarget, navigate, readObjectId, onError,
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
    timer = setTimeout(() => { timer = null; void hop(false); }, dwellMs);
  }
  return Object.freeze({
    get playing() { return playing; },
    start, stop,
    destroy() { stop(); events.abort(); },
  });
}
