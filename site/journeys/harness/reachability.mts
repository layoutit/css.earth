/** Listener tap ported from the performance probe; registration stacks resolve through the supplied build's maps. */
import { listenerResolver } from './listener-resolver.mts';
import type { ListenerWrapper } from './binding-sites.mts';
import type { Page } from 'playwright';

export interface ManifestEntry { id: string; kind: string; source: string; eventTypes?: string[]; mechanism?: string; tag?: string; selector?: string; markup?: string }
export function parseEntries(input: unknown): ManifestEntry[] {
  if (!input || typeof input !== 'object' || !('entries' in input) || !Array.isArray(input.entries)) throw new Error('Expected S0 entries');
  return input.entries.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || !('kind' in row) || typeof row.kind !== 'string'
      || !('source' in row) || typeof row.source !== 'string') throw new Error('Invalid manifest entry');
    const entry: ManifestEntry = { id: row.id, kind: row.kind, source: row.source };
    for (const key of ['mechanism', 'tag', 'selector', 'markup'] as const) if (key in row) {
      const value: unknown = Reflect.get(row, key); if (typeof value !== 'string') throw new Error('Invalid manifest text'); entry[key] = value;
    }
    if ('eventTypes' in row) {
      if (!Array.isArray(row.eventTypes) || !row.eventTypes.every(value => typeof value === 'string')) throw new Error('Invalid event types');
      entry.eventTypes = row.eventTypes;
    }
    return entry;
  });
}
/** Tag-only and colliding candidates are unresolved, never credited by guessing. */
export function controlSelectors(entries: readonly ManifestEntry[]) {
  const candidates = entries.filter(entry => entry.kind === 'control' && entry.tag && ['button', 'input', 'select', 'a', 'summary'].includes(entry.tag)).flatMap(entry => {
    const classes = entry.markup?.match(/\bclass=["']([^"'{}]+)["']/u)?.[1]?.trim().split(/\s+/u);
    const selector = classes?.length ? entry.tag + '[class=' + JSON.stringify(classes.join(' ')) + ']'
      : entry.selector && entry.selector !== entry.tag ? entry.tag + entry.selector : null;
    if (!selector) return [];
    const fixed = [...(entry.markup ?? '').matchAll(/\b(target|type|name|form|role)=["']([^"'{}]*)["']/gu)].map(match => `[${match[1]}=${JSON.stringify(match[2])}]`).join('');
    return [{ id: entry.id, selector: selector + fixed }];
  });
  return candidates.filter(row => candidates.filter(other => other.selector === row.selector).length === 1);
}
export function installTap(controls: { id: string; selector: string }[]) {
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  const records: { type: string; stack: string; controls: string[] }[] = [];
  const driven = new Set<string>();
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
    const stack = new Error().stack ?? '';
    return Reflect.apply(raf, this, [(time: number) => {
      records.push({ type: 'animation-frame', stack, controls: [] });
      return Reflect.apply(callback, window, [time]);
    }]);
  };
  const wrappers = new WeakMap<EventTarget, Map<string, WeakMap<object, { wrapped: EventListener; active: boolean; signal?: AbortSignal }>>>();
  const capture = (options?: boolean | AddEventListenerOptions | EventListenerOptions) => typeof options === 'boolean' ? options : options?.capture === true;
  function controlsFor(event: Event) {
    if (!event.isTrusted || !['click', 'change', 'input', 'submit'].includes(event.type)) return [];
    const target = event.target instanceof Element ? event.target : null;
    return controls.flatMap(row => {
      let element: Element | null = null;
      try { element = target?.closest(row.selector) ?? null; } catch { return []; }
      if (!element || !element.isConnected || element.closest('[hidden],[inert]') || element.matches(':disabled')) return [];
      return [row.id];
    });
  }
  for (const type of ['click', 'change', 'input', 'submit']) Reflect.apply(add, document, [type, (event: Event) => {
    for (const id of controlsFor(event)) driven.add(id);
  }, true]);
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (!listener) return Reflect.apply(add, this, [type, listener, options]);
    let target = wrappers.get(this); if (!target) { target = new Map(); wrappers.set(this, target); }
    const key = type + ':' + capture(options);
    let callbacks = target.get(key); if (!callbacks) { callbacks = new WeakMap(); target.set(key, callbacks); }
    let entry = callbacks.get(listener);
    if (!entry?.active || entry.signal?.aborted) {
      const stack = new Error().stack ?? '';
      const registration = { active: true, signal: typeof options === 'object' ? options.signal : undefined };
      const wrapped = function(this: EventTarget, event: Event) {
        if (typeof options === 'object' && options.once) registration.active = false;
        records.push({ type, stack, controls: controlsFor(event) });
        if (typeof listener === 'function') return Reflect.apply(listener, this, [event]);
        return listener.handleEvent(event);
      };
      entry = { ...registration, wrapped };
      // Share active state with the once callback rather than a copied boolean.
      Object.defineProperty(entry, 'active', { get: () => registration.active, set: value => { registration.active = value; } });
      callbacks.set(listener, entry);
    }
    return Reflect.apply(add, this, [type, entry.wrapped, options]);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    const entry = listener && wrappers.get(this)?.get(type + ':' + capture(options))?.get(listener);
    if (entry) entry.active = false;
    return Reflect.apply(remove, this, [type, entry?.wrapped ?? listener, options]);
  };
  Reflect.set(window, '__journeyReachability', { read: () => ({ records, controls: [...driven].sort() }) });
}
export async function reachability(page: Page, dist: string, entries: ManifestEntry[], checkout = process.cwd(), wrappers: ListenerWrapper[] = []) {
  await page.addInitScript(installTap, controlSelectors(entries));
  const interpret = listenerResolver(dist, entries, checkout, wrappers);
  return async () => {
    const value: unknown = await page.evaluate(() => {
      const probe: unknown = Reflect.get(window, '__journeyReachability');
      if (!probe || typeof probe !== 'object' || !('read' in probe) || typeof probe.read !== 'function') throw new Error('Missing reachability tap');
      return probe.read();
    });
    if (!value || typeof value !== 'object' || !('records' in value) || !Array.isArray(value.records)
      || !('controls' in value) || !Array.isArray(value.controls) || !value.controls.every(id => typeof id === 'string')) throw new Error('Invalid reachability evidence');
    const evidence = await interpret(value.records);
    return { observed: [...new Set([...value.controls, ...evidence.observed])].sort(), unresolved: evidence.unresolved, records: value.records };
  };
}
export function requireObserved(exercises: readonly string[], observed: readonly string[]) {
  const missing = exercises.filter(id => !observed.includes(id));
  if (missing.length) throw new Error('Declared but unobserved: ' + missing.join(', '));
}
