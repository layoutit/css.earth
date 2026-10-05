/** Capability witnesses use observer-owned native event history and live rendered state. */
import type { Page } from 'playwright';
import { json, type Json } from './trace.mts';
import { ALLOWED } from './probe.mts';
export type CapabilityKind = 'DPR' | 'responsive' | 'reducedMotion' | 'tabFocus' | 'touch' | 'penPointer' | 'visibility' | 'worker' | 'coldWarmCache' | 'coast';
export const CAPABILITY_PROBE = `(() => {
  const events = [], resizes = [{ width: innerWidth, height: innerHeight }];
  const visible = element => element instanceof Element && element.isConnected && !element.closest('[hidden],[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  let tab = null, pendingFocus = null;
  document.addEventListener('keydown', event => { if (event.isTrusted && event.key === 'Tab') { tab = document.activeElement; events.push({ type: 'Tab', trusted: true }); } }, true);
  document.addEventListener('focusin', event => { if (tab && event.isTrusted && event.target !== tab && visible(event.target)) {
    pendingFocus = event.target; tab = null;
  } }, true);
  for (const type of ['pointerdown', 'pointerup']) document.addEventListener(type, event => {
    if (event.isTrusted && ['touch', 'pen'].includes(event.pointerType) && visible(event.target)) events.push({ type, pointerType: event.pointerType, trusted: true, target: event.target.localName });
  }, true);
  document.addEventListener('visibilitychange', event => { if (event.isTrusted) events.push({ type: 'visibilitychange', state: document.visibilityState, trusted: true }); }, true);
  addEventListener('resize', event => { if (event.isTrusted) resizes.push({ width: innerWidth, height: innerHeight }); }, true);
  window.__journeyCapabilities = () => {
    if (pendingFocus && pendingFocus === document.activeElement && visible(pendingFocus) && pendingFocus.matches(':focus-visible')) {
      const style = getComputedStyle(pendingFocus);
      const indicator = { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), outlineColor: style.outlineColor, boxShadow: style.boxShadow, textDecorationLine: style.textDecorationLine };
      const colored = value => value !== 'transparent' && !/rgba\\([^)]*,\\s*0\\s*\\)$/.test(value);
      if (indicator.outlineWidth > 0 && !['none','hidden'].includes(indicator.outlineStyle) && colored(indicator.outlineColor))
        events.push({ type: 'tabFocus', trusted: true, target: pendingFocus.localName, id: pendingFocus.id, indicator });
      pendingFocus = null;
    }
    const surface = document.querySelector('.object-input-surface'), rect = surface && surface.getBoundingClientRect();
    const rendered = ['.object-stage', '.object-world-stage'].map(selector => {
      const stage = document.querySelector(selector);
      if (!visible(stage)) return null;
      const nodes = [...stage.querySelectorAll('s,img,svg path')].filter(visible);
      const box = stage.getBoundingClientRect(), style = getComputedStyle(stage);
      return nodes.length && box.width > 0 && box.height > 0 ? { selector, nodes: nodes.length, width: box.width, height: box.height, transform: style.transform, opacity: style.opacity } : null;
    }).find(Boolean) || null;
    const animations = document.getAnimations().map(animation => ({ id: animation.id, playState: animation.playState }));
    return { events: [...events], resizes: [...resizes], dpr: devicePixelRatio, width: innerWidth, height: innerHeight, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      surface: visible(surface) && rect ? { width: rect.width, height: rect.height, rendered } : null, animations };
  };
})()`;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed capability witness');
  return Object.fromEntries(Object.entries(value));
}
function positive(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
export function validateCapability(kind: Exclude<CapabilityKind, 'worker' | 'coldWarmCache' | 'coast'>, input: unknown, profile: unknown, previousReduced?: unknown): Json {
  const state = object(input), configured = object(profile);
  if (!Array.isArray(state.events) || !Array.isArray(state.resizes)) throw new Error('Missing observer event history');
  const events = state.events.map(object), resizes = state.resizes.map(object);
  const surface = state.surface ? object(state.surface) : null;
  const scene = surface?.rendered ? object(surface.rendered) : null;
  const rendered = surface && positive(surface.width) && positive(surface.height) && scene && positive(scene.width) && positive(scene.height) && positive(scene.nodes)
    && ['.object-stage', '.object-world-stage'].includes(String(scene.selector));
  if (kind === 'DPR') {
    if (!rendered || !positive(configured.deviceScaleFactor) || state.dpr !== configured.deviceScaleFactor) throw new Error('DPR witness needs matching profile, native DPR and rendered surface');
    return json({ profileDPR: configured.deviceScaleFactor, nativeDPR: state.dpr, surface });
  }
  if (kind === 'responsive') {
    if (!rendered || !positive(state.width) || !positive(state.height) || !resizes.some(row => positive(row.width) && positive(row.height) && (row.width !== state.width || row.height !== state.height))
      || !resizes.some(row => row.width === state.width && row.height === state.height)) throw new Error('Responsive witness needs native resize delivery and rendered layout');
    return json({ resizes, viewport: { width: state.width, height: state.height }, surface });
  }
  if (kind === 'reducedMotion') {
    if (typeof state.reduced !== 'boolean' || !Array.isArray(state.animations)) throw new Error('Missing reduced-motion query/playback evidence');
    const animation = state.animations.map(object).find(row => row.id === 'cv-mon-light-curve');
    if (!animation || animation.playState !== (state.reduced ? 'paused' : 'running')) throw new Error('Reduced-motion query does not match prepared playback permission');
    if (previousReduced !== undefined && previousReduced === state.reduced) throw new Error('Reduced-motion witness needs a media preference transition');
    return json({ reduced: state.reduced, animation, transition: previousReduced !== undefined });
  }
  if (kind === 'visibility') {
    const changes = events.filter(row => row.type === 'visibilitychange' && row.trusted === true);
    const hidden = changes.findIndex(row => row.state === 'hidden');
    if (hidden < 0 || !changes.slice(hidden + 1).some(row => row.state === 'visible')) throw new Error('Visibility witness needs real trusted hidden then visible transitions');
    return json({ transitions: changes });
  }
  const event = events.find(row => row.trusted === true && (kind === 'tabFocus' ? row.type === 'tabFocus' : row.type === 'pointerdown' && row.pointerType === (kind === 'touch' ? 'touch' : 'pen')));
  if (!event || kind === 'touch' && configured.hasTouch !== true) throw new Error(`${kind} witness needs trusted native delivery${kind === 'touch' ? ' under a touch profile' : ''}`);
  if (kind === 'tabFocus') {
    const indicator = object(event.indicator);
    if (!(positive(indicator.outlineWidth) && typeof indicator.outlineStyle === 'string' && !['none', 'hidden'].includes(indicator.outlineStyle)
      && typeof indicator.outlineColor === 'string' && indicator.outlineColor !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)$/u.test(indicator.outlineColor))) throw new Error('Tab focus needs a painted focus indicator');
  }
  return json(event);
}
export async function readCapabilities(page: Page): Promise<Json> {
  return json(await page.evaluate(() => {
    const probe: unknown = Reflect.get(window, '__journeyCapabilities');
    if (typeof probe !== 'function') throw new Error('Missing native capability observer');
    return probe();
  }));
}
/** Exact regex positions mirror the six S0 lab entries. Document exceptions require an owner-specific write. */
export function coastWitnesses(rows: readonly Json[], completed: boolean): { id: string; evidence: Json }[] {
  if (!completed) return [];
  const observed: { id: string; evidence: Json }[] = [];
  const add = (id: string, row: Json) => { if (!observed.some(value => value.id === id)) observed.push({ id, evidence: row }); };
  for (const input of rows) {
    const row = object(input);
    if (row.coasting !== true || typeof row.key !== 'string' || typeof row.subject !== 'string' || row.before === row.value) continue;
    ALLOWED.forEach((pattern, index) => { if (pattern.test(row.key as string)) add(`capability:labs:performance:coast-writes:coast-allowed-write:${index + 1}`, input); });
    const owner = row.subject;
    const doc = 'capability:docs:performance:motion-freezes-membership:coast-exception:';
    if ((/ \[points\]$| \{ stroke-opacity \}$| <\+polyline>$/u.test(row.key)) && /svg\.context-orbit-strokes/u.test(owner)) add(doc + 'orbit-strokes:1', input);
    if (/ \[d\]$/u.test(row.key) && /div\.point-layer/u.test(owner)) add(doc + 'batched-star-points:1', input);
    if (/ \{ background-position \}$/u.test(row.key) && /earth-material|earth-atmosphere-material/u.test(owner)) add(doc + "earth's-lighting-frame:1", input);
    if (/ \{ (visibility|background-image) \}( removed)?$/u.test(row.key) && /data-sky-face/u.test(owner)
      && (!row.key.includes('background-image') || row.before === null || row.before === '' || row.before === 'none')) add(doc + 'sky-faces:1', input);
  }
  return observed;
}

/** A worker URL and a reply must belong to the same native worker instance. */
export function workerWitness(input: unknown, urls: readonly string[]): Json {
  const state = object(input);
  if (!Array.isArray(state.workerEvidence)) throw new Error('Missing per-worker reply ownership');
  const workers = state.workerEvidence.map(object).filter(entry => typeof entry.url === 'string' && urls.includes(entry.url)
    && /world-context-planner-worker|prepared-data-worker/u.test(entry.url) && typeof entry.nativeReplies === 'number'
    && entry.nativeReplies > 0 && entry.jobs === 0 && entry.replies === 0);
  if (!workers.length) throw new Error('Worker witness requires one application worker with a native completed reply and no pending work');
  return json(workers);
}
