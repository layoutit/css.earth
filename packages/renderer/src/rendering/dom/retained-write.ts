/** Retained DOM writes that skip a value this module already wrote to the same element.
 *
 * A guard that reads the value back from the DOM fails for anything the browser normalizes: `translate(1px,2px)` reads
 * back as `translate(1px, 2px)`, `0.30000000000000004` as `0.3`, `url(a)` as `url("a")`, so the compare never matches
 * and the value is written on every frame (Chromium and WebKit, 2026-10-01). The last written string is kept here
 * instead and the DOM is never read.
 *
 * One owner writes a given property of a given element, always through these functions: a direct write elsewhere leaves
 * the remembered value stale and the next equal write is skipped. A property first written while the element is built
 * may be written directly; the first write through here always lands. */

interface StyleTarget { readonly style: object }
interface DataTarget { readonly dataset: object }

const written = new WeakMap<object, Map<string, string>>();
const counts = { written: 0, skipped: 0 };

function changed(target: object, key: string, value: string): boolean {
  let values = written.get(target);
  if (!values) written.set(target, values = new Map());
  if (values.get(key) === value) { counts.skipped++; return false; }
  values.set(key, value); counts.written++;
  return true;
}

/** Writes one inline style property, named as on `element.style` (`transform`). Returns whether the value was written.
 * The renderer writes no custom property: a value goes on the element that draws it. */
export function writeStyle(element: StyleTarget, property: string, value: string): boolean {
  if (property.startsWith('--')) throw new TypeError(`The renderer writes no custom property: ${property}.`);
  if (!changed(element.style, property, value)) return false;
  (element.style as Record<string, string>)[property] = value;
  return true;
}

/** Writes one `data-*` attribute, named as on `element.dataset`. Returns whether the value was written. */
export function writeData(element: DataTarget, key: string, value: string): boolean {
  if (!changed(element.dataset, key, value)) return false;
  (element.dataset as Record<string, string>)[key] = value;
  return true;
}

/** Writes made and writes skipped since the page loaded: a publication of an unchanged view adds only to `skipped`. */
export function retainedWriteCounts(): { readonly written: number; readonly skipped: number } { return { ...counts }; }
