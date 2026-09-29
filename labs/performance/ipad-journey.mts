#!/usr/bin/env node
/**
 * A small, ordered scenario language for the iPad capture harness.
 *
 * This compiler deliberately emits page-dispatched events.  They exercise the
 * application's event handlers through Web Inspector, but are not native iPad
 * touch.  The generated script returns that provenance into the capture report.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readPreparedObjects } from '@cssearth/objects/node';
import type { Step } from './ios-capture.mts';

const OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../..')).objects;

export const JOURNEY_INPUT_SOURCE = 'page-dispatched' as const;
export type FlightSource = 'scene-router' | 'objectnavigate';
export type Point = readonly [number, number];

export type JourneyAction =
  | { readonly fly: string }
  | { readonly zoom: number }
  | { readonly drag: { readonly from: Point; readonly to: Point; readonly seconds: number } }
  | { readonly tap: Point }
  | { readonly type: string }
  | { readonly wait: number }
  | { readonly screenshot: string }
  | { readonly viewport: string }
  | { readonly probe: string }
  | { readonly script: string };

export interface Journey {
  readonly start?: string;
  readonly actions: readonly JourneyAction[];
}

const NAME = /^[a-z0-9-]+$/u;

function point(value: unknown, label: string): Point {
  const values = requireArray(value, label);
  if (values.length !== 2) throw new TypeError(`${label} must be [x, y].`);
  return [requireFiniteNumber(values[0], label), requireFiniteNumber(values[1], label)];
}

function name(value: unknown, label: string) {
  const valueName = requireString(value, label);
  if (!NAME.test(valueName)) throw new TypeError(`${label} must be lowercase words and dashes.`);
  return valueName;
}

function action(value: unknown, index: number): JourneyAction {
  const record = requireRecord(value, `journey action ${index}`), keys = Object.keys(record);
  if (keys.length !== 1) throw new TypeError(`Journey action ${index} must have exactly one action.`);
  const label = `journey action ${index}`;
  if ('fly' in record) return { fly: resolveObject(requireString(record.fly, label), label).id };
  if ('zoom' in record) return { zoom: requireFiniteNumber(record.zoom, label) };
  if ('tap' in record) return { tap: point(record.tap, label) };
  if ('type' in record) return { type: requireString(record.type, label) };
  if ('wait' in record) return { wait: requireFiniteNumber(record.wait, label) };
  if ('screenshot' in record) return { screenshot: name(record.screenshot, label) };
  if ('viewport' in record) return { viewport: name(record.viewport, label) };
  if ('probe' in record) return { probe: name(record.probe, label) };
  if ('script' in record) return { script: requireString(record.script, label) };
  if ('drag' in record) {
    const drag = requireRecord(record.drag, label);
    if (Object.keys(drag).sort().join(',') !== 'from,seconds,to') throw new TypeError(`${label}.drag must have from, to and seconds.`);
    const seconds = requireFiniteNumber(drag.seconds, `${label}.drag.seconds`);
    if (seconds < 0) throw new RangeError(`${label}.drag.seconds must not be negative.`);
    return { drag: { from: point(drag.from, `${label}.drag.from`), to: point(drag.to, `${label}.drag.to`), seconds } };
  }
  throw new TypeError(`${label}: unknown action ${keys[0]}.`);
}

/** Validate scenario JSON before a capture connects to a device. */
export function parseJourney(value: unknown): Journey {
  const record = requireRecord(value, 'journey');
  for (const key of Object.keys(record)) if (key !== 'start' && key !== 'actions') throw new TypeError(`Journey has unknown field ${key}.`);
  if (!('actions' in record)) throw new TypeError('Journey needs an actions array.');
  const start = record.start === undefined ? undefined : resolveObject(requireString(record.start, 'journey start'), 'journey start').id;
  return Object.freeze({ ...(start === undefined ? {} : { start }), actions: Object.freeze(requireArray(record.actions, 'journey actions').map(action)) });
}

/** Resolve a stable object id or its displayed name.  The registry remains the source of valid destinations. */
function resolveObject(value: string, label: string) {
  const normalized = value.trim().toLocaleLowerCase('en');
  const object = OBJECTS.find(candidate => candidate.id === normalized || candidate.name.toLocaleLowerCase('en') === normalized);
  if (!object) throw new TypeError(`${label}: unknown cssEarth object ${JSON.stringify(value)}.`);
  return object;
}

const pageScript = (body: string) => `(() => {\n  if (document.visibilityState !== 'visible') throw new Error('Journey target is not the visible Safari tab.');\n  const source = ${JSON.stringify(JOURNEY_INPUT_SOURCE)};\n${body}\n})()`;

function flightScript(id: string, flightSource: FlightSource): string {
  const object = resolveObject(id, 'flight');
  if (flightSource === 'objectnavigate') return pageScript(`  return (async () => {
    const objectId = ${JSON.stringify(object.id)}, deadline = Date.now() + 30000;
    while (true) {
      if (document.visibilityState !== 'visible') throw new Error('Journey target is not the visible Safari tab.');
      if (document.documentElement.dataset.ready === 'error') throw new Error('Journey start scene failed.');
      const query = new CustomEvent('objectnavigationquery', { bubbles: true, cancelable: true, detail: { objectId } });
      document.dispatchEvent(query);
      if (document.documentElement.dataset.ready === 'true' && query.defaultPrevented) break;
      if (Date.now() >= deadline) throw new Error('Live navigation is not ready for ' + objectId + '.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const selected = new CustomEvent('objectnavigate', { bubbles: true, cancelable: true, detail: { objectId } });
    document.dispatchEvent(selected);
    if (!selected.defaultPrevented) throw new Error('Live app did not accept navigation to ' + objectId + '.');
    return { source: 'objectnavigate', action: 'fly', objectId, url: location.href,
      version: document.querySelector('a[aria-label^="GitHub v"]')?.getAttribute('aria-label') ?? null };
  })();`);
  return pageScript(`  const control = window.__cssEarthControl;
  if (!control || typeof control.fly !== 'function') throw new Error('Journey flight: the performance router bridge is unavailable. Build and serve with --mode performance.');
  return control.fly(${JSON.stringify(object.id)});`);
}

function gestureScript(action: 'tap' | 'drag', from: Point, to: Point = from, seconds = 0): string {
  return pageScript(`  return (async () => {
    const eventAt = (type, x, y, buttons) => {
      const target = document.elementFromPoint(x, y);
      if (!(target instanceof Element) || target.closest('[hidden]')) throw new Error('Journey ${action}: no visible target at ' + x + ', ' + y + '.');
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons, clientX: x, clientY: y }));
    };
    eventAt('pointerdown', ${from[0]}, ${from[1]}, 1);
    ${action === 'drag' ? `const duration = ${seconds} * 1000, started = performance.now();
    do { const ratio = duration === 0 ? 1 : Math.min(1, (performance.now() - started) / duration);
      eventAt('pointermove', ${from[0]} + (${to[0]} - ${from[0]}) * ratio, ${from[1]} + (${to[1]} - ${from[1]}) * ratio, 1);
      if (ratio < 1) await new Promise(resolve => requestAnimationFrame(resolve));
      else break;
    } while (true);` : ''}
    eventAt('pointerup', ${to[0]}, ${to[1]}, 0);
    return { source, action: ${JSON.stringify(action)}, from: [${from[0]}, ${from[1]}], to: [${to[0]}, ${to[1]}] };
  })();`);
}

function zoomScript(delta: number): string {
  return pageScript(`  const target = document.querySelector('.object-input-surface');
  if (!(target instanceof Element) || target.getClientRects().length === 0) throw new Error('Journey zoom: visible scene input surface is missing.');
  target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, composed: true, deltaY: ${delta}, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
  return { source, action: 'zoom', delta: ${delta} };`);
}

function typeScript(text: string): string {
  return pageScript(`  const target = document.activeElement;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) throw new Error('Journey type: focus a text input before typing.');
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;
  if (!setter) throw new Error('Journey type: input value setter is unavailable.');
  setter.call(target, target.value + ${JSON.stringify(text)});
  target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(text)} }));
  return { source, action: 'type', text: ${JSON.stringify(text)} };`);
}

/** Compile a validated semantic journey into ios-capture's existing step language. */
export function compileJourney(journey: Journey, flightSource: FlightSource = 'scene-router'): Step[] {
  const normalized = parseJourney(journey);
  // start selects the URL before capture.  A fly is an in-capture UI action and
  // the route step waits after the Safari page has swapped contexts.
  const steps: Step[] = [];
  for (const action of normalized.actions) {
    if ('fly' in action) steps.push({ script: flightScript(action.fly, flightSource) }, { route: resolveObject(action.fly, 'flight').route });
    else if ('zoom' in action) steps.push({ script: zoomScript(action.zoom) });
    else if ('tap' in action) steps.push({ script: gestureScript('tap', action.tap) });
    else if ('drag' in action) steps.push({ script: gestureScript('drag', action.drag.from, action.drag.to, action.drag.seconds) });
    else if ('type' in action) steps.push({ script: typeScript(action.type) });
    else steps.push(action);
  }
  return steps;
}

/** Ordered flag form for shells that do not want to create a JSON file. */
export function parseJourneyArgs(args: readonly string[]): Journey {
  const actions: JourneyAction[] = [];
  let start: string | undefined;
  const one = (index: number, flag: string) => {
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) throw new TypeError(`${flag} needs a value.`);
    return value;
  };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (flag === '--start') { if (start !== undefined) throw new TypeError('--start may appear once.'); start = one(index++, flag); }
    else if (flag === '--fly') actions.push({ fly: one(index++, flag) });
    else if (flag === '--zoom') actions.push({ zoom: Number(one(index++, flag)) });
    else if (flag === '--tap') actions.push({ tap: point(JSON.parse(one(index++, flag)), '--tap') });
    else if (flag === '--drag') actions.push({ drag: requireRecord(JSON.parse(one(index++, flag)), '--drag') as JourneyAction & { drag: { from: Point; to: Point; seconds: number } }['drag'] });
    else if (flag === '--type') actions.push({ type: one(index++, flag) });
    else if (flag === '--wait') actions.push({ wait: Number(one(index++, flag)) });
    else if (flag === '--screenshot') actions.push({ screenshot: one(index++, flag) });
    else if (flag === '--viewport') actions.push({ viewport: one(index++, flag) });
    else if (flag === '--probe') actions.push({ probe: one(index++, flag) });
    else if (flag === '--script') actions.push({ script: one(index++, flag) });
    else throw new TypeError(`Unknown journey flag ${flag}.`);
  }
  return parseJourney({ ...(start === undefined ? {} : { start }), actions });
}

async function main() {
  const args = process.argv.slice(2);
  const scenario = args.indexOf('--scenario');
  const journey = scenario < 0 ? parseJourneyArgs(args) : (() => {
    if (args.length !== 2) throw new TypeError('--scenario <file> cannot be combined with ordered flags.');
    return null;
  })();
  const parsed = journey ?? parseJourney(JSON.parse(await readFile(args[scenario + 1] ?? '', 'utf8')));
  console.log(JSON.stringify({ inputSource: JOURNEY_INPUT_SOURCE, steps: compileJourney(parsed) }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main().catch((error: unknown) => {
  console.error(`ipad-journey: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
