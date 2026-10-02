import type { OrientationXyzw, PhysicalCameraPose } from '@cssearth/engine';
import type { WorldCameraPose } from '../../packages/renderer/src/navigation/world-camera.js';
import { required } from '@cssearth/objects/node/contract';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { decodeWorldOrbitBank, decodeWorldOrbits, orbitVertices, parseCompleteWorldContext, parsePreparedWorldContext, parsePreparedWorldContextSummary } from '../../packages/renderer/src/prepared-data/world-context.js';
import { mountPreparedWorldContext } from '../../packages/renderer/src/universe/prepared-world-context.js';
import { worldContextGeometry } from '../../packages/renderer/src/prepared-data/world-context.js';
import type { WorldContextFrame } from '../../packages/renderer/src/universe/world-context/world-context-frame.js';
import type { PlannedWorldContext } from '../../packages/renderer/src/universe/world-context/world-context-planner.js';
import { preparedVolumeOpacity } from '../../packages/renderer/src/universe/world-context/context-scale.js';
import { labelRectsOverlap } from '../../packages/renderer/src/labels/screen-label-layout.js';
import { screenPicking } from '../../packages/renderer/src/navigation/screen-picking.js';
import { createWorldContextFrameEncoder } from '../../packages/renderer/src/universe/world-context/world-context-frame.js';
import { type PackedWorldContextView, unpackWorldBodies } from '../../packages/renderer/src/universe/world-context/world-context-view-transport.js';
import { createWorldContextPlanner } from '../../packages/renderer/src/universe/world-context/world-context-planner.js';
import { CONTEXT_LINE_WIDTH, INDICATOR_DOT_MAX_DIAMETER, indicatorDotDiameter } from '../../packages/renderer/src/universe/world-context/context-scale.js';
import { SCENE_OBJECTS } from '../objects.mts';
import { isPlacedClassification } from '@cssearth/objects';
import { labelImportance } from '../../packages/renderer/src/labels/universe-label-policy.js';
import { SYSTEM_RANGES, SYSTEM_VIEWS, SYSTEM_VIEW_HOSTS, loadSystemView, systemFramingRect, systemViewTarget } from '../system-framing.mts';
import { stubGlobal, unstubAllGlobals } from '@cssearth/objects/node/contract';
import { unpackPreparedBinary } from '@cssearth/objects/node';
// System framing's candidates load after the first body mounts in the app; these tests need them loaded.
await Promise.all([...SYSTEM_VIEW_HOSTS].map(id => loadSystemView(id, async host => JSON.parse(await (await import('node:fs/promises')).readFile(new URL(`../../src/objects/sun/prepared/system-views/${host}.json`, import.meta.url), 'utf8')))));

// The production publisher only accepts encoded frames. Tests run the actual
// planner inline and supply that same protocol without starting a browser worker.
/** The worker's view: the renderer ships body columns, the planner reads bodies. */
const unpacked = ({ bodyColumns, ...view }: PackedWorldContextView) => ({ ...view, bodies: unpackWorldBodies(bodyColumns) });

function mountTestContext({ annotationPriorities, annotationLandmarks, ...options }:
  Parameters<typeof mountPreparedWorldContext>[0] & { annotationPriorities?: Readonly<Record<string, number>>; annotationLandmarks?: readonly string[] }) {
  let latest: [WorldCameraPose, Parameters<ReturnType<typeof mountPreparedWorldContext>['publish']>[1]] | null = null;
  let planner: ReturnType<typeof createWorldContextPlanner> | undefined, sequence = 0;
  const encode = createWorldContextFrameEncoder();
  const layer = mountPreparedWorldContext({ ...options, requestPublication() {
    if (options.requestPublication?.()) return true;
    if (latest && options.plan.schema === 'cssearth-world-context@2') publish(...latest);
    return true;
  } });
  function publish(world: WorldCameraPose, viewport: Parameters<typeof layer.publish>[1], frame?: WorldContextFrame | PlannedWorldContext) {
    latest = [world, viewport];
    if (frame && 'updates' in frame) { layer.publish(world, viewport, frame); return; }
    const snapshot = layer.captureFrame(world, viewport);
    const planned = frame ?? (planner ??= createWorldContextPlanner(worldContextGeometry(options.plan), annotationPriorities, annotationLandmarks))(unpacked(snapshot.view));
    // Explicit complete-frame cases use a fresh baseline; ordinary samples keep their acknowledged delta chain.
    layer.publish(world, viewport, encode(++sequence, frame ? 0 : snapshot.view.contextCommittedId ?? 0, planned));
  }
  return { ...layer, publish };
}

/** Every style, data-attribute and attribute write that changes a value, while a test records: the browser fast-path check. */
let writeLog: string[] | null = null;
const logWrite = (element: FakeElement, what: string, before: unknown, after: unknown) => {
  if (writeLog && String(before ?? '') !== String(after ?? '')) writeLog.push(`${element.tagName} ${what}`);
};
class FakeElement extends EventTarget {
  readonly children: FakeElement[] = [];
  styleWrites = 0;
  private readonly styleValues: Record<string, string> = Object.assign({ opacity: '' } as Record<string, string>, {
    getPropertyValue: (name: string) => this.style[name] ?? '',
    setProperty: (name: string, value: string) => { this.style[name] = value; },
  });
  // cssText also sets its declarations, as a browser parses them, so `style.pointerEvents` reads a declared value.
  readonly style = new Proxy(this.styleValues, { set: (target, key, value) => { this.styleWrites++; logWrite(this, `style.${String(key)}`, Reflect.get(target, key), value); Reflect.set(target, key, value);
    if (key === 'cssText') for (const declaration of String(value).split(';')) {
      const colon = declaration.indexOf(':');
      if (colon > 0) Reflect.set(target, declaration.slice(0, colon).trim().replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase()), declaration.slice(colon + 1).trim());
    }
    return true; } });
  attributeWrites = 0;
  private readonly datasetValues: Record<string, string> = {};
  readonly dataset: Record<string, string> = new Proxy(this.datasetValues, {
    set: (target, key, value) => { this.attributeWrites++; logWrite(this, `data-${String(key)}`, Reflect.get(target, key), value); Reflect.set(target, key, value); return true; },
    deleteProperty: (target, key) => { logWrite(this, `data-${String(key)} removed`, Reflect.get(target, key), undefined); return Reflect.deleteProperty(target, key); },
  });
  parentNode: FakeElement | null = null;
  get parentElement(): FakeElement | null { return this.parentNode; }
  get isConnected(): boolean { return this.parentNode !== null; }
  closest(selector: string): FakeElement | null {
    if (selector.startsWith('.') && this.className.split(' ').includes(selector.slice(1))) return this;
    return this.parentNode?.closest(selector) ?? null;
  }
  className = ''; textContent = ''; hidden = false; clientWidth = 0; clientHeight = 0;
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  constructor(ownerDocument: FakeDocument, tagName: string) { super(); this.ownerDocument = ownerDocument; this.tagName = tagName; }
  measurements = 0;
  getBoundingClientRect() { this.measurements++; return { width: this.dataset.contextName.length * 6, height: 14 }; }
  readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string): void { logWrite(this, `@${name}`, this.attributes.get(name), value); this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  append(...entries: FakeElement[]): void { for (const entry of entries) this.insertBefore(entry, null); }
  appendChild(entry: FakeElement): FakeElement { this.append(entry); return entry; }
  insertBefore(entry: FakeElement, before: FakeElement | null): void {
    entry.remove(); entry.parentNode = this;
    const index = before === null ? this.children.length : this.children.indexOf(before);
    this.children.splice(index < 0 ? this.children.length : index, 0, entry);
  }
  remove(): void { if (this.parentNode) { const index = this.parentNode.children.indexOf(this); if (index >= 0) this.parentNode.children.splice(index, 1); this.parentNode = null; } }
  get firstChild(): FakeElement | null { return this.children[0] ?? null; }
  get lastChild(): FakeElement | null { return this.children.at(-1) ?? null; }
  /** A clone copies declared state without counting it as writes, as a browser copies attributes. */
  cloneNode(deep = false): FakeElement {
    const clone = this.ownerDocument.createElement(this.tagName);
    clone.className = this.className; clone.textContent = this.textContent; clone.hidden = this.hidden;
    for (const [key, value] of Object.entries(this.styleValues)) if (typeof value === 'string') clone.styleValues[key] = value;
    Object.assign(clone.datasetValues, this.datasetValues);
    for (const [name, value] of this.attributes) clone.attributes.set(name, value);
    if (deep) for (const child of this.children) clone.appendChild(child.cloneNode(true));
    return clone;
  }
}
// The fake DOM has no cascade. world-context.css holds every marker's and orbit's constant geometry, so an element's
// declared value is its inline one, else the one the winning world-context.css rule gives it (a desktop viewport: its
// media blocks only scale annotations). Selectors with pseudo-classes or pseudo-elements never style these elements'
// asserted properties and are left out.
type SelectorStep = { readonly combinator: ' ' | '>'; readonly tag?: string; readonly classes: readonly string[];
  readonly attributes: readonly (readonly [string, string | undefined])[] };
const worldContextRules = (await readFile(new URL('../../packages/renderer/src/styles/world-context.css', import.meta.url), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//gu, '').replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gu, '')
  .split('}').flatMap((block, order) => {
    const [selectors = '', body = ''] = block.split('{');
    const declarations = Object.fromEntries(body.split(';').map(entry => entry.split(':')).filter(pair => pair.length >= 2)
      .map(([name, ...value]) => [name!.trim().replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase()), value.join(':').trim()]));
    return selectors.split(',').map(selector => selector.trim()).filter(selector => selector && !selector.includes(':')).map(selector => {
      const steps: SelectorStep[] = [];
      let combinator: ' ' | '>' = ' ';
      for (const token of selector.replace(/\s*>\s*/gu, ' > ').split(/\s+/u)) {
        if (token === '>') { combinator = '>'; continue; }
        steps.push({ combinator, tag: /^[a-z]+/u.exec(token)?.[0], classes: [...token.matchAll(/\.([\w-]+)/gu)].map(match => match[1]!),
          attributes: [...token.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/gu)].map(match => [match[1]!, match[2]] as const) });
        combinator = ' ';
      }
      const specificity = steps.reduce((sum, step) => sum + (step.classes.length + step.attributes.length) * 1000 + (step.tag ? 1 : 0), 0);
      return { steps, specificity, order, declarations };
    });
  });
function attributeOf(element: FakeElement, name: string): string | undefined {
  if (name === 'class') return element.className || undefined;
  if (name.startsWith('data-')) return element.dataset[name.slice(5).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())];
  return element.getAttribute(name) ?? undefined;
}
function matchesStep(element: FakeElement, step: SelectorStep): boolean {
  const classes = element.className.split(' ');
  return (!step.tag || element.tagName === step.tag) && step.classes.every(name => classes.includes(name)) &&
    step.attributes.every(([name, value]) => { const actual = attributeOf(element, name); return actual !== undefined && (value === undefined || actual === value); });
}
// A retained owner the view has not attached yet is styled as it will be once attached: under the world's root.
const detachedRoot = { className: 'prepared-world-context', tagName: 'div', dataset: {}, parentNode: null, getAttribute: () => null } as unknown as FakeElement;
const parentOf = (element: FakeElement): FakeElement | null => element.parentNode ??
  (element === detachedRoot || element.className.split(' ').includes('prepared-world-context') ? null : detachedRoot);
function matchesSelector(element: FakeElement | null, steps: readonly SelectorStep[], index = steps.length - 1): boolean {
  if (!element || !matchesStep(element, steps[index]!)) return false;
  if (index === 0) return true;
  if (steps[index]!.combinator === '>') return matchesSelector(parentOf(element), steps, index - 1);
  for (let ancestor = parentOf(element); ancestor; ancestor = parentOf(ancestor)) if (matchesSelector(ancestor, steps, index - 1)) return true;
  return false;
}
/** The value `property` (camelCase) takes on `element`: inline first, then world-context.css by specificity and order. */
function declared(element: FakeElement | HTMLElement, property: string): string {
  if (!(element instanceof FakeElement)) throw new TypeError(`declared() reads the test's fake elements, not ${String(element)}.`);
  const inline = element.style[property];
  if (typeof inline === 'string' && inline !== '') return inline;
  const winner = worldContextRules.filter(rule => property in rule.declarations && matchesSelector(element, rule.steps))
    .sort((a, b) => b.specificity - a.specificity || b.order - a.order)[0];
  return winner?.declarations[property] ?? '';
}
class Clock extends EventTarget {
  now = 0; next = 0; frames = new Map<number, (time: number) => void>(); timers = new Map<number, { at: number; callback: () => void }>();
  performance = { now: () => this.now };
  getComputedStyle = (element: FakeElement, pseudo: string) => {
    // The caption element's ::after holds the name; its marker counts the measurement.
    assert.equal(pseudo, '::after'); (element.className === 'context-caption' ? element.parentNode! : element).measurements++;
    return { width: `${element.dataset.contextName.length * 6}px`, height: '14px' };
  };
  requestAnimationFrame = (callback: (time: number) => void) => { const id = ++this.next; this.frames.set(id, callback); return id; };
  cancelAnimationFrame = (id: number) => { this.frames.delete(id); };
  setTimeout = (callback: () => void, milliseconds: number) => { const id = ++this.next; this.timers.set(id, { at: this.now + milliseconds, callback }); return id; };
  clearTimeout = (id: number) => { this.timers.delete(id); };
  advance(milliseconds: number) {
    this.now += milliseconds;
    const frames = [...this.frames.values()]; this.frames.clear(); for (const callback of frames) callback(this.now);
    for (const [id, timer] of [...this.timers]) if (timer.at <= this.now) { this.timers.delete(id); timer.callback(); }
  }
}
class FakeDocument {
  defaultView = new Clock();
  readonly allocated: FakeElement[] = [];
  createElement(tagName: string): FakeElement { const element = new FakeElement(this, tagName); this.allocated.push(element); return element; }
  createElementNS(_namespace: string, tagName: string): FakeElement { return this.createElement(tagName); }
}

const mounted = new WeakMap<FakeElement, ReturnType<typeof mountTestContext>>();

test('approximate orbit cues stay on retained groups through selection and publication', () => {
  const original = plan(1);
  const input = { ...original, bodies: [{ ...original.bodies[0], placement: 'approximate' }, original.bodies[1]] };
  const prepared = parsePreparedWorldContext(input);
  assert.equal(prepared.bodies[0]!.placement, 'approximate');
  assert.deepEqual(prepared.bodies[0]!.orbit, original.bodies[0]!.orbit);
  assert.throws(() => parsePreparedWorldContext({ ...input, bodies: [{ ...input.bodies[0], placement: 'unknown' }] }), /placement/);
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: prepared, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement;
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } } as const;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] } as const;
  // Orbit leaf blocks are built on first use and then retained.
  layer.publish(world, viewport);
  const group = find(root, 'contextGroup', 'mercury'), count = all(root).length;
  layer.selectObject('mercury');
  layer.publish(world, viewport);
  assert.equal(group.dataset.contextPlacement, 'approximate');
  assert.equal(find(root, 'contextLabel', 'mercury').dataset.contextName, 'Mercury (approx)');
  assert.equal(find(root, 'contextOrbit', 'mercury').dataset.contextPlacement, 'approximate');
  assert.equal(find(root, 'contextGroup', 'venus').dataset.contextPlacement, undefined);
  assert.equal(all(root).length, count);
  layer.destroy();
});
const sprite = { url: '/marker.png', index: 0, count: 1, size: 16 };
const presentation = {
  projection: { model: 'css-perspective-shared-with-sky', cssPerspective: '86.60254037844386cqw' },
  dolly: { model: 'multiplicative-wheel-distance', wheelStepPerDelta: .006, minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 1 },
  levelOfDetail: { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20, billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 },
  orbitLineFade: { visibleBelowDiscHeightShare: .12, hiddenAboveDiscHeightShare: .3 }, drag: { model: 'screen-axis-tumble' },
};
const orbit = (position: readonly [number, number, number], scale: number) => ({
  centerBodyId: 'sun', centerPositionM: [0, 0, 0],
  verticesM: [[position[0], position[1], position[2]], [0, 100, 0], [-100, 0, 0], [0, -100, 0], [100, 0, 0], [0, 100, 0], [-100, 0, 0], [0, -100, 0]].map(v => v.map(n => n * scale)),
  trail: [1, 1, 1, 1, 1, 1, 1, 1],
});
function plan(scale: number) {
  const point = (id: string, name: string, color: string, position: readonly [number, number, number], radius: number) => ({ id, name, color, positionM: position.map(value => value * scale), radiusM: radius * scale });
  const focus = point('sun', 'Sun', '#f5a623', [0, 0, 0], 10);
  const front = point('mercury', 'Mercury', '#9d9388', [100, 0, 0], 1);
  const hidden = point('venus', 'Venus', '#d6aa69', [0, 0, -20], 1);
  return parsePreparedWorldContext({ schema: 'cssearth-world-context@2',
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: scale, bodyRadiusM: 10 * scale },
    focus, bodies: [{ ...front, orbit: orbit([100, 0, 0], scale) }, { ...hidden, orbit: orbit([0, 0, -20], scale) }],
    camera: { minimumDistanceM: 12 * scale, maximumDistanceM: 10_000 * scale, framingReferenceZoom: 1, presentation },
    volume: { objectId: 'milky-way', fadeStartDistanceM: 100 * scale, fullDistanceM: 1_000 * scale }, system: { fadeOutStartDistanceM: scale, hiddenDistanceM: 1e30 * scale },
    stars: { objectId: 'stellar-neighbourhood', fadeStartDistanceM: 10 * scale, fullDistanceM: 50 * scale },
    sky: { sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' },
  });
}
function find(root: FakeElement, key: string, value: string): FakeElement {
  // State assertions can inspect retained detached owners; DOM admission is checked separately by parent/children.
  const found = [root, ...all(root), ...root.ownerDocument.allocated].find(element => element.dataset[key] === value);
  if (!found) throw new Error(`Missing ${key}=${value}`); return found;
}
// World owners and orbit leaf blocks attach on first demand and then remain retained. Every earlier node
// survives in order; new additions must belong to these presentation owners. The one
// corner locator is the exception by design: a single element that moves into whichever
// marker is emphasised, so it and its two paths are left out of the order.
const isLocator = (node: FakeElement) => node.getAttribute('class') === 'context-locator' || node.parentNode?.getAttribute('class') === 'context-locator';
function expectRetained(root: FakeElement, retained: readonly FakeElement[]) {
  const nodes = retained.filter(node => !isLocator(node));
  const known = new Set(nodes), now = all(root).filter(node => !isLocator(node)), kept = now.filter(node => known.has(node));
  assert.equal((kept.length === nodes.length && kept.every((node, index) => node === nodes[index])), true, 'every retained node survives in order');
  const demandedOwner = (node: FakeElement): boolean => node.className.split(' ').includes('context-orbit') ||
    node.dataset.contextBody !== undefined || node.children.some(child => child.dataset.contextBody !== undefined) ||
    node.className === 'context-orbit-block' || (node.parentNode !== null && node.parentNode !== root && demandedOwner(node.parentNode));
  assert.equal(now.every(node => known.has(node) || demandedOwner(node)), true, 'only demanded world owners or orbit leaves are attached');
}
function captionName(element: { dataset: { contextName?: string } }): string {
  const name = element.dataset.contextName;
  if (name === undefined) throw new Error('A shown caption has no name.');
  return name;
}
test('validated immutable context is shared, while modified transport still gets validated', () => {
  const prepared = plan(1);
  assert.equal(parsePreparedWorldContext(prepared), prepared);
  // Orbit paths are typed arrays (views over the orbit bank), which cannot be frozen; the records around them are.
  assert.throws(() => { Object.assign(prepared.bodies[0]!.orbit!, { centerBodyId: 'moved' }); });
  const transport = structuredClone(prepared);
  const validated = parsePreparedWorldContext(transport);
  assert.notEqual(validated, transport);
  assert.deepEqual(validated, prepared);
  transport.bodies[0]!.orbit!.verticesM[0] = 0;
  assert.throws(() => parsePreparedWorldContext(transport), /align/);
  assert.equal(parsePreparedWorldContext(validated), validated);
});
function all(root: FakeElement): FakeElement[] { return root.children.flatMap(child => [child, ...all(child)]); }
// Inspect the one real element's pseudo state and composed transform. These
// helpers return values, never pretend the pseudos are independent DOM nodes.
function annotationVisibility(element: HTMLElement | FakeElement, part: 'label' | 'indicator') {
  return element.style.visibility !== 'hidden' && element.dataset[part === 'label' ? 'contextLabelVisible' : 'contextIndicatorVisible'] === 'true' ? '' : 'hidden';
}
// Per-frame motion and paint order belong to the bare mover that wraps each
// marker. The marker keeps its stable style, attributes and two pseudos, so
// every transform or z-index expectation reads the mover instead.
function mover(element: HTMLElement | FakeElement): FakeElement {
  const parent = (element as FakeElement).parentNode;
  if (!parent) throw new Error('A marker outside its mover has no transform owner.');
  return parent;
}
function billboardCenter(element: HTMLElement | FakeElement): number[] {
  const moved = mover(element);
  // The context root is a zero-size anchor at the stage centre, so a mover's translation is already centre-relative.
  const [x, y] = moved.style.transform.match(/-?[\d.]+/g)!.map(Number);
  return [x, y];
}
function captionPosition(element: HTMLElement | FakeElement): number[] {
  const [x, y] = billboardCenter(element);
  const caption = (element as unknown as { children: HTMLElement[] }).children.find(child => child.className === 'context-caption');
  const [dx, dy] = (caption?.style.transform ?? '').match(/-?[\d.]+/g)?.map(Number) ?? [12, -9];
  return [x + dx, y + dy];
}
const paintedOrbitLeaf = (piece: HTMLElement | SVGElement) => piece.getAttribute('stroke-opacity') !== null
  ? Boolean(piece.getAttribute('d')) : piece.style.visibility === '';
const orbitLeafWeight = (piece: HTMLElement | SVGElement) => Number(piece.getAttribute('stroke-opacity') ?? piece.style.opacity);
function mount(scale: number, requestPublication?: () => boolean) {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: plan(scale), sprites: { sun: sprite, mercury: sprite, venus: sprite }, requestPublication });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1_000 * scale], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [30, -20] });
  mounted.set(layer.root as unknown as FakeElement, layer);
  return layer.root as unknown as FakeElement;
}

test('open world trajectories validate their epoch vertex and never accept a closing weight', () => {
  const original = plan(1), body = original.bodies[0]!;
  const verticesM = [[-100, -50, 0], [-50, -30, 0], [0, -10, 0], [100, 0, 0],
    [150, 20, 0], [200, 50, 0], [250, 90, 0], [300, 140, 0]];
  const orbit = { centerBodyId: 'sun', centerPositionM: [0, 0, 0], verticesM, closed: false,
    bodyVertexIndex: 3, displayExtentAu: 600, trailModel: 'finite-open-trajectory-constant-weight',
    trail: Array(7).fill(1), activeChords: [0, 1, 2, 3, 4, 5, 6], extentChords: [0, 3, 1, 5, 2, 4, 6] };
  const input = { ...original, bodies: [{ ...body, orbit }, original.bodies[1]] };
  assert.deepEqual(parsePreparedWorldContext(input).bodies[0]!.orbit, { ...orbit, verticesM: Float64Array.from(verticesM.flat()), trail: Float64Array.from(orbit.trail),
    activeChords: Uint32Array.from(orbit.activeChords), extentChords: Uint32Array.from(orbit.extentChords), vertexCount: 8, fullTrail: true });
  for (const invalid of [{ closed: true }, { bodyVertexIndex: undefined }, { bodyVertexIndex: 0 }, { bodyVertexIndex: 8 },
    { trail: Array(8).fill(1) }, { trail: [0, 1, 1, 1, 1, 1, 1] }, { displayExtentAu: 0 },
    { activeChords: [0, 1, 2, 3, 4, 5, 7] }]) {
    assert.throws(() => parsePreparedWorldContext({ ...input, bodies: [{ ...body, orbit: { ...orbit, ...invalid } }, original.bodies[1]] }));
  }
});

test('semantic changes invalidate worker snapshots without synchronously republishing geometry', () => {
  const request = mock.fn(() => true), root = mount(1, request), layer = mounted.get(root)!;
  const clock = root.ownerDocument.defaultView;
  clock.advance(1000);
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const planner = createWorldContextPlanner(plan(1));
  const drawing = () => JSON.stringify(all(root).map(node => node.style));
  for (const change of [() => layer.setOverview(true), () => layer.setBodyVisibility({ orbitHidden: ['mercury'] }),
    () => layer.setBodyVisibility({ labelHidden: ['venus'] }), () => layer.previewSelection('mercury')]) {
    const stale = layer.captureFrame(world, viewport), before = drawing(), calls = request.mock.calls.length;
    change();
    assert.equal(stale.current(), false);
    assert.equal(request.mock.calls.length, calls + 1);
    assert.equal(drawing(), before);
    const fresh = layer.captureFrame(world, viewport);
    layer.publish(world, viewport, planner(unpacked(fresh.view)));
    clock.advance(1000);
  }
  // A hover decides which annotations show, not where bodies project: a plan in
  // flight stays valid (discarding it would cost a full repair of every body),
  // nothing is drawn synchronously, and the next captured view carries the hover.
  const before = drawing(), stale = layer.captureFrame(world, viewport);
  find(root, 'contextGroup', 'mercury').dataset.objectHovered = 'true';
  root.parentNode!.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16);
  assert.equal(stale.current(), true);
  assert.equal(drawing(), before);
  assert.equal(unpacked(layer.captureFrame(world, viewport).view).bodies[1].hovered, true);
  layer.destroy();
});

test('a flight frame that attaches markers waits for the flight to republish; a still view asks at once', () => {
  const first = { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const context = (request: () => boolean) => {
    const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
    host.clientWidth = 800; host.clientHeight = 600; host.append(before);
    return mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite }, requestPublication: request });
  };
  const still = mock.fn(() => true), resting = context(still);
  resting.publish(first, viewport);
  assert.equal(still.mock.calls.length, 1);
  resting.destroy();
  const request = mock.fn(() => true), flying = context(request);
  flying.setNavigationInFlight(true);
  const started = request.mock.calls.length;
  flying.publish(first, viewport);
  assert.equal(request.mock.calls.length, started);
  flying.setNavigationInFlight(false);
  assert.equal(request.mock.calls.length, started + 1);
  flying.destroy();
});

test('inactive annotations retain emphasis until their reveal publication', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const nodes = all(root), groups = ['sun', 'mercury', 'venus'].map(id => find(root, 'contextGroup', id));
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const away = { ...world, pose: { ...world.pose, orientationXyzw: [0, 1, 0, 0] as const } };
  layer.publish(away, viewport);
  clock.advance(1000);
  layer.publish(away, viewport);
  const retained = groups.map(group => group.dataset.contextSelected);
  layer.setOverview(true);
  clock.advance(1000);
  layer.publish(away, viewport);
  assert.deepEqual(groups.map(group => group.dataset.contextSelected), retained);
  layer.publish(world, viewport);
  clock.advance(1000);
  layer.publish(world, viewport);
  const shown = layer.inspect().filter(body => body.mover.style.visibility !== 'hidden');
  assert.ok(shown.length > 0);
  // Emphasis is two-state. The overview emphasizes nobody, so the Sun that was
  // selected before the bodies were culled must publish 'false' on its reveal.
  for (const body of shown) assert.equal(find(root, 'contextGroup', body.id).dataset.contextSelected, 'false');
  expectRetained(root, nodes);
  layer.destroy();
});

test('a body carries its prepared colour inline, and the emphasised one wears the one corner locator by inheritance', () => {
  const base = plan(1), colours: Record<string, string> = { mercury: '#abcdef', venus: '#123456' };
  const prepared = { ...base, focus: { ...base.focus, contextColor: '#fedcba' },
    bodies: base.bodies.map(body => ({ ...body, contextColor: colours[body.id]!, labelCase: 'upper' as const })) };
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: prepared,
    sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement;
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const, widthPixels: 800, heightPixels: 600 };
  const mercury = find(root, 'contextGroup', 'mercury'), venus = find(root, 'contextGroup', 'venus'), sun = find(root, 'contextGroup', 'sun');
  // No stylesheet rule per body: the colour and caption case are on the marker and its orbit.
  assert.deepEqual(([mercury.style.color, venus.style.color, find(root, 'contextOrbit', 'mercury').style.color]), ['#abcdef', '#123456', '#abcdef']);
  assert.equal(mercury.dataset.contextLabelCase, 'upper');
  const locatorIn = (marker: FakeElement) => marker.children.find(child => child.getAttribute('class') === 'context-locator');
  layer.selectObject('mercury'); layer.publish(world, viewport);
  const locator = locatorIn(mercury)!;
  // It sits under the sprite, as the ring does, and has no colour of its own: its paths fill with currentColor.
  assert.equal(mercury.children.indexOf(locator), mercury.children.findIndex(child => child.tagName === 'i') - 1);
  assert.deepEqual(([locator.style.color ?? '', ...locator.children.map(path => path.getAttribute('fill'))]), ['', 'currentColor', 'currentColor']);
  assert.deepEqual(([mercury.dataset.contextLocator, venus.dataset.contextLocator]), ['', undefined]);
  layer.selectObject('sun'); layer.publish(world, viewport);
  // The same element moves; the marker it leaves returns to its ring.
  assert.deepEqual(([locatorIn(sun), locatorIn(mercury), mercury.dataset.contextLocator, sun.dataset.contextLocator]), [locator, undefined, undefined, '']);
  layer.destroy();
});

test('a culled indicator with retained alpha is dormant, then gets current emphasis on reveal', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const mercury = layer.inspect().find(body => body.id === 'mercury')!;
  const group = find(root, 'contextGroup', 'mercury');
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const,
    widthPixels: 1, heightPixels: 1 };
  // Emphasis is two-state, so the body has to be the emphasized one before it
  // is culled for a dormant value to be distinguishable from a current one.
  layer.selectObject('mercury');
  layer.publish(world, { ...viewport, widthPixels: 800, heightPixels: 600 });
  assert.equal(group.dataset.contextSelected, 'true');
  layer.publish(world, viewport); clock.advance(1000);
  assert.equal(mercury.mover.style.visibility, 'hidden');
  assert.equal(Number(mercury.mover.style.opacity), 0);
  const retained = group.dataset.contextSelected;
  assert.equal(retained, 'true');
  layer.setOverview(true); layer.publish(world, viewport);
  assert.equal(group.dataset.contextSelected, retained);
  layer.publish(world, { ...viewport, widthPixels: 800, heightPixels: 600 });
  assert.equal(mercury.mover.style.visibility, '');
  assert.equal(group.dataset.contextSelected, 'false');
  layer.destroy();
});

test('a resolved background sprite does not pick through its transparent square corners', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.selectObject('mercury');
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 100], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  const registry = screenPicking(root.parentNode! as unknown as HTMLElement);
  const sun = layer.inspect().find(body => body.id === 'sun')!.billboard;
  assert.equal(registry.pick(0, 0), sun);
  assert.notEqual(registry.pick(35, 35), sun);
  layer.destroy();
});

test('camera viewport snapshots drive clipping and resize without reading host layout', () => {
  const root = mount(1), layer = mounted.get(root)!;
  Object.defineProperties(root.parentNode!, {
    clientWidth: { get() { throw new Error('Publication flushed host layout'); } },
    clientHeight: { get() { throw new Error('Publication flushed host layout'); } },
  });
  const mercury = layer.inspect().find(entry => entry.id === 'mercury')!;
  const publish = (widthPixels: number, heightPixels: number) => layer.publish({
    referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1_000], orientationXyzw: [0, 0, 0, 1] },
  }, { focalPixels: 400, principalOffsetPixels: [30, -20], widthPixels, heightPixels });
  publish(800, 600);
  assert.equal(mercury.mover.style.visibility, '');
  publish(40, 600);
  assert.equal(mercury.mover.style.visibility, 'hidden');
  publish(800, 600);
  assert.equal(mercury.mover.style.visibility, '');
  publish(800, 10);
  assert.equal(mercury.mover.style.visibility, 'hidden');
  layer.destroy();
});

test('hidden orbit selection leaves other orbits intact and retains the same body nodes', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const target = find(root, 'contextOrbit', 'mercury'), other = find(root, 'contextOrbit', 'venus');
  const visibleTarget = target.style.opacity, visibleOther = other.style.opacity;
  assert.notEqual(visibleTarget, '0');
  layer.setBodyVisibility({ orbitHidden: ['mercury'] });
  root.ownerDocument.defaultView.advance(200);
  assert.equal(target.style.opacity, '0');
  assert.equal(declared(target, 'pointerEvents'), 'none');
  assert.equal(target.dataset.objectNavigate, undefined);
  assert.equal(other.style.opacity, visibleOther);
  assert.equal(find(root, 'contextLabel', 'mercury').style.visibility, '');
  assert.equal(find(root, 'contextBody', 'mercury').style.visibility, '');
  expectRetained(root, nodes);
  layer.setNavigationInFlight(true);
  layer.setBodyVisibility({ orbitHidden: [] });
  assert.equal(target.style.opacity, visibleTarget);
  assert.equal(target.dataset.objectNavigate, undefined);
  layer.setNavigationInFlight(false);
  assert.equal(target.style.opacity, visibleTarget);
  assert.equal(target.dataset.objectNavigate, 'mercury');
  assert.equal(other.style.opacity, visibleOther);
  expectRetained(root, nodes);
  layer.destroy();
});

test('hover-only trails reveal the full orbit and keep their circle and label before and after hover', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map(body => ({ ...body,
    orbit: { ...body.orbit, trail: [0, 0, 0, .2, .4, .6, .8, 1], activeChords: [3, 4, 5, 6, 7] },
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.setBodyVisibility({ orbitHidden: ['mercury', 'venus'] });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const circle = find(root, 'contextBody', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  const orbit = find(root, 'contextOrbit', 'mercury'), other = find(root, 'contextOrbit', 'venus');
  for (const hovered of [false, true, false]) {
    circle.dataset.objectHovered = String(hovered);
    host.dispatchEvent(new Event('objecthoverchange'));
    document.defaultView.advance(16); document.defaultView.advance(200);
    assert.equal(annotationVisibility(circle, 'indicator'), '');
    assert.equal(annotationVisibility(label, 'label'), '');
    assert.equal((orbit.style.opacity === '0'), !hovered);
    if (hovered) {
      const visiblePieces = layer.inspect().find(body => body.id === 'mercury')!.orbit.filter(piece => piece.style.visibility === '');
      assert.ok(visiblePieces.length > 5);
      assert.equal(visiblePieces.every(piece => Number(piece.style.opacity) === 1), true);
    }
    assert.equal(orbit.dataset.objectNavigate, undefined);
    // The stage picker owns every hit. A paint node that was never navigable
    // keeps only the inert pointer policy it declared when it was mounted.
    assert.equal(orbit.style.pointerEvents, undefined);
    assert.equal(declared(orbit, 'pointerEvents'), 'none');
    assert.equal(other.style.opacity, '0');
  }
  // Hover builds the full orbit's leaf blocks on first use.
  expectRetained(root, nodes);
  layer.destroy();
});

test('open trajectories stay hidden until their body circle is hovered', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), body = source.bodies[0]!;
  const verticesM = [[-100, -50, 0], [-50, -30, 0], [0, -10, 0], [100, 0, 0],
    [150, 20, 0], [200, 50, 0], [250, 90, 0], [300, 140, 0]];
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit: {
    centerBodyId: 'sun', centerPositionM: [0, 0, 0], verticesM, closed: false,
    bodyVertexIndex: 3, displayExtentAu: 600, trailModel: 'finite-open-trajectory-constant-weight',
    trail: Array(7).fill(1), activeChords: [0, 1, 2, 3, 4, 5, 6], extentChords: [0, 3, 1, 5, 2, 4, 6],
  } }, source.bodies[1]!] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const publish = () => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  publish();
  const root = layer.root as unknown as FakeElement;
  const circle = find(root, 'contextBody', 'mercury'), orbit = find(root, 'contextOrbit', 'mercury');
  assert.equal(annotationVisibility(circle, 'indicator'), '');
  assert.equal(orbit.style.opacity, '0');
  circle.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); publish(); document.defaultView.advance(200);
  assert.notEqual(orbit.style.opacity, '0');
  assert.equal(layer.inspect().find(entry => entry.id === 'mercury')!.orbit.some(piece => paintedOrbitLeaf(piece)), true);
  circle.dataset.objectHovered = 'false';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); publish(); document.defaultView.advance(200);
  assert.equal(orbit.style.opacity, '0');
  layer.destroy();
});

test('an unlabelled minor body cannot leave an anonymous orbit across the stage', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite },
    annotationPriorities: { mercury: 1, venus: 3 } });
  layer.setBodyVisibility({ labelHidden: ['mercury'] });
  const publish = () => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  publish();
  const root = layer.root as unknown as FakeElement;
  const marker = find(root, 'contextBody', 'mercury'), orbit = find(root, 'contextOrbit', 'mercury');
  assert.equal(annotationVisibility(marker, 'indicator'), 'hidden');
  assert.equal(orbit.style.opacity, '0');
  marker.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); publish(); document.defaultView.advance(200);
  assert.equal(annotationVisibility(marker, 'indicator'), '');
  assert.notEqual(orbit.style.opacity, '0');
  marker.dataset.objectHovered = 'false';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); publish(); document.defaultView.advance(200);
  assert.equal(orbit.style.opacity, '0');
  layer.destroy();
});

test('hidden annotations leave the physical dot pickable and hover reveals the complete annotation', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const clock = root.ownerDocument.defaultView, host = root.parentNode!;
  const circle = find(root, 'contextBody', 'mercury');
  const label = find(root, 'contextLabel', 'mercury');
  const orbit = find(root, 'contextOrbit', 'mercury');
  const other = find(root, 'contextOrbit', 'venus');
  const sunLabel = find(root, 'contextLabel', 'sun');
  layer.setBodyVisibility({ orbitHidden: ['mercury', 'venus'] });
  layer.setBodyVisibility({ labelHidden: ['mercury', 'venus'] });
  clock.advance(200);
  assert.equal(annotationVisibility(label, 'label'), 'hidden');
  assert.equal(annotationVisibility(circle, 'indicator'), 'hidden');
  assert.equal(circle.dataset.objectNavigate, 'mercury');
  assert.equal(annotationVisibility(sunLabel, 'label'), '');
  circle.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16); clock.advance(200);
  assert.equal(annotationVisibility(label, 'label'), '');
  assert.equal(label.dataset.objectNavigate, 'mercury');
  assert.notEqual(orbit.style.opacity, '0');
  assert.equal(all(orbit).some(piece => piece.tagName === 's' && piece.style.visibility === '' &&
    piece.parentNode?.style.display === 'contents'), true);
  // A temporarily revealed orbit cannot keep itself hovered after leaving the circle.
  assert.equal(orbit.dataset.objectNavigate, undefined);
  assert.equal(declared(orbit, 'pointerEvents'), 'none');
  assert.equal(other.style.opacity, '0');
  delete circle.dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16); clock.advance(200);
  assert.equal(annotationVisibility(label, 'label'), 'hidden');
  assert.equal(orbit.style.opacity, '0');
  assert.equal(circle.dataset.objectNavigate, 'mercury');
  layer.setBodyVisibility({ labelHidden: [] }); clock.advance(200);
  assert.equal(annotationVisibility(label, 'label'), '');
  assert.equal(orbit.style.opacity, '0');
  layer.setBodyVisibility({ orbitHidden: [] });
  layer.setBodyVisibility({ labelHidden: ['mercury'] }); clock.advance(200);
  assert.equal(annotationVisibility(label, 'label'), 'hidden');
  assert.equal(orbit.dataset.objectNavigate, undefined);
  assert.equal(orbit.style.opacity, '0');
  expectRetained(root, nodes);
  layer.destroy();
  host.dispatchEvent(new Event('objecthoverchange'));
  assert.equal(clock.frames.size, 0);
});

test('a highlighted set reveals hidden labels and marks its retained groups until cleared', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const group = find(root, 'contextGroup', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  const clock = root.ownerDocument.defaultView;
  const nodes = all(root);
  // The caption is this marker's own pseudo-element, so its visibility is the
  // published attribute the style reads, not a style property of a label node.
  layer.setBodyVisibility({ labelHidden: ['mercury'] }); clock.advance(16); clock.advance(200);
  assert.equal(label.dataset.contextLabelVisible, 'false');
  layer.setBodyVisibility({ highlighted: ['mercury'] }); clock.advance(16); clock.advance(200);
  assert.equal(label.dataset.contextLabelVisible, 'true');
  assert.equal(group.dataset.contextHighlight, 'true');
  assert.equal(root.dataset.contextHighlighting, 'true');
  layer.setBodyVisibility({ highlighted: [] }); clock.advance(16); clock.advance(200);
  assert.equal(label.dataset.contextLabelVisible, 'false');
  assert.equal(group.dataset.contextHighlight, undefined);
  assert.equal(root.dataset.contextHighlighting, undefined);
  assert.deepEqual(all(root), nodes);
  layer.destroy();
});

test('keyboard focus also reveals a hidden label and orbit, then retires them on blur', () => {
  const root = mount(1), layer = mounted.get(root)!, host = root.parentNode!;
  const circle = find(root, 'contextBody', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  const clock = root.ownerDocument.defaultView;
  layer.setBodyVisibility({ orbitHidden: ['mercury'] }); layer.setBodyVisibility({ labelHidden: ['mercury'] });
  Object.assign(root.ownerDocument, { activeElement: circle });
  host.dispatchEvent(new Event('focusin')); clock.advance(16); clock.advance(200);
  assert.equal(annotationVisibility(label, 'label'), '');
  Object.assign(root.ownerDocument, { activeElement: null });
  host.dispatchEvent(new Event('focusout')); clock.advance(16); clock.advance(200);
  assert.equal(annotationVisibility(label, 'label'), 'hidden');
  layer.destroy();
});

test('camera publication consumes interaction changes without polling retained DOM state', () => {
  const root = mount(1), layer = mounted.get(root)!, host = root.parentNode!;
  const group = find(root, 'contextGroup', 'mercury');
  const label = find(root, 'contextLabel', 'mercury');
  const circle = find(root, 'contextBody', 'mercury');
  let hovered: string | undefined, focused: FakeElement | null = null;
  let hoverReads = 0, focusReads = 0;
  Object.defineProperty(group.dataset, 'objectHovered', { get() { hoverReads++; return hovered; } });
  Object.defineProperty(root.ownerDocument, 'activeElement', { get() { focusReads++; return focused; } });
  const publish = (distance = 1_000) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20], widthPixels: 800, heightPixels: 600 });
  layer.setBodyVisibility({ labelHidden: ['mercury'] });
  for (let distance = 1_000; distance < 1_020; distance++) publish(distance);
  assert.equal(hoverReads, 0); assert.equal(focusReads, 0);
  hovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  // A camera sample can arrive before the scheduled annotation callback.
  publish();
  assert.equal(annotationVisibility(label, 'label'), '');
  assert.equal(hoverReads, 1); assert.equal(focusReads, 1);
  root.ownerDocument.defaultView.advance(16);
  assert.equal(hoverReads, 1); assert.equal(focusReads, 1);
  publish(1e31); // Retire non-anchor publication.
  hovered = undefined; focused = circle;
  host.dispatchEvent(new Event('objecthoverchange'));
  host.dispatchEvent(new Event('focusin'));
  publish(1e31); publish();
  assert.equal(annotationVisibility(label, 'label'), '');
  assert.equal(hoverReads, 2); assert.equal(focusReads, 2);
  focused = null; host.dispatchEvent(new Event('focusout'));
  publish(); root.ownerDocument.defaultView.advance(200);
  assert.equal(annotationVisibility(label, 'label'), 'hidden');
  assert.equal(hoverReads, 3); assert.equal(focusReads, 3);
  layer.destroy();
  host.dispatchEvent(new Event('objecthoverchange'));
  root.ownerDocument.defaultView.advance(200);
  assert.equal(hoverReads, 3); assert.equal(focusReads, 3);
});

function expectAlignedContextOrigin(actual: readonly number[], expected: readonly number[], label: string): void {
  assert.equal(actual.length, 3); assert.equal(expected.length, 3);
  // Match preparation's positionToleranceM policy: saved frames and freshly
  // reconstructed matrix products differ by millimetres across V8 platforms.
  const toleranceM = Math.max(.001, 8 * Number.EPSILON * Math.max(...actual.map(Math.abs), ...expected.map(Math.abs)));
  const separationM = Math.hypot(...actual.map((value, axis) => value - required(expected[axis])));
  assert.ok(separationM <= toleranceM, label);
}

test('context alignment accepts observed Linux roundoff but rejects detached origins', () => {
  const saved = [4464323069020.515, 219850064405.67654, -21150265923.520695] as const;
  const linux = [4464323069020.515, 219850064405.67706, -21150265923.520573] as const;
  assert.doesNotThrow(() => expectAlignedContextOrigin(linux, saved, 'observed Neptune reconstruction'));
  assert.throws(() => expectAlignedContextOrigin([linux[0] + 1, linux[1], linux[2]], saved, 'one metre drift'));
  assert.doesNotThrow(() => expectAlignedContextOrigin([0, .0005, 0], [0, 0, 0], 'near-origin roundoff'));
  assert.throws(() => expectAlignedContextOrigin([0, .002, 0], [0, 0, 0], 'near-origin displacement'));
});

// Every malformed case parses the whole generated universe again, so the test's time grows with the number of bodies.
test('accepts the generated Sun context and rejects detached or malformed prepared data', { timeout: 20000 }, async () => {
  const source = JSON.parse(await readFile(fileURLToPath(new URL('../../src/objects/sun/prepared/world-context.json', import.meta.url)), 'utf8')) as Record<string, unknown>;
  const [{ readCatalog }, { parseNavigationDistance }] = await Promise.all([import('@cssearth/objects/node'), import('@cssearth/objects')]);
  // Each entry's distance as `prepare:catalog` placed it in the registry.
  // Every body of the world: the scenes, the packages the host draws (galaxies, clusters, nebulae) and the levels that are bodies.
  const worldObjects = (await import('@cssearth/objects/node')).readPreparedObjects(fileURLToPath(new URL('../..', import.meta.url))).worldObjects;
  const distance = (descriptor: unknown) => parseNavigationDistance(worldObjects.find(object => object.id === (descriptor as { id: string }).id)?.distance);
  const contextEntries = (await readCatalog(fileURLToPath(new URL('../../src/objects', import.meta.url)), distance)).filter(body => body.context && body.id !== 'sun')
    .sort((a, b) => (a.context!.order ?? Number.MAX_SAFE_INTEGER) - (b.context!.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id, 'en'));
  // Bodies drawn from their astronomy records around a packaged host follow the catalogue's own entries.
  assert.deepEqual(parsePreparedWorldContext(source).bodies.filter(body => !body.unpackaged).map(body => body.id), contextEntries.map(body => body.id));
  for (const body of parsePreparedWorldContext(source).bodies.filter(body => !body.unpackaged)) {
    const frame = worldObjects.find(object => object.id === body.id)!.worldFrame!;
    assert.equal(body.radiusM, frame.bodyRadiusM, `${body.id} context must match the selectable detail radius`);
    expectAlignedContextOrigin(body.positionM, frame.originM, `${body.id} context must match the selectable detail origin`);
    // A placed body (a star, a black hole, a galaxy, a cluster, a nebula) has no orbit in the Sun's context; every orbiting body's orbit facts are prepared.
    if (!body.orbit) { assert.ok(isPlacedClassification(worldObjects.find(object => object.id === body.id)!.classification)); continue; }
    assert.notEqual(body.orbit.bounds, undefined, `${body.id} orbit bounds are owned by preparation`);
    assert.deepEqual(([...body.orbit.activeChords!]), [...body.orbit.trail].flatMap((weight, index) => weight > 0 ? [index] : []));
    assert.deepEqual([...(body.orbit.extentChords ?? [])].sort((a, b) => a - b), [...body.orbit.activeChords!]);
  }
  assert.throws(() => parsePreparedWorldContext({ ...source, focus: { ...(source.focus as Record<string, unknown>), positionM: [1, 0, 0] } }), /frame origin/);
  const camera = source.camera as Record<string, unknown>, presentation = camera.presentation as Record<string, unknown>;
  assert.throws(() => parsePreparedWorldContext({ ...source, camera: { ...camera, presentation: { ...presentation, dolly: { ...(presentation.dolly as Record<string, unknown>), minimumDistanceRadii: 1 } } } }), /outside the focus/);
  const body = (source.bodies as Record<string, unknown>[])[0]!;
  assert.throws(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit: { ...(body.orbit as Record<string, unknown>), verticesM: [[0, 0, 0], ...((body.orbit as { verticesM: unknown[] }).verticesM.slice(1))] } }, ...(source.bodies as unknown[]).slice(1)] }), /align/);
  assert.throws(() => parsePreparedWorldContext({ ...source, sky: { sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,1)' } }), /pure matrix3d rotation/);
  const bodies = source.bodies as Record<string, unknown>[];
  for (const orbit of [{ ...(body.orbit as object), centerBodyId: 'unprepared-parent' },
    { ...(body.orbit as object), centerPositionM: [1, 0, 0] },
    { ...(body.orbit as object), centerBodyId: undefined },
    { ...(body.orbit as object), bounds: { centerM: [0, 0, 0], radiusM: 1 } },
    { ...(body.orbit as object), bounds: { centerM: [0, 0, 0], radiusM: Infinity } },
    { ...(body.orbit as object), activeChords: [] },
    { ...(body.orbit as object), activeChords: [0, 0] },
    { ...(body.orbit as object), extentChords: [] },
    { ...(body.orbit as object), extentChords: (body.orbit as { extentChords: number[] }).extentChords.map(() => 0) },
    { ...(body.orbit as object), extentChords: (body.orbit as { extentChords: number[] }).extentChords.map((value, index) => index === 0 ? .5 : value) },
    { ...(body.orbit as object), runtimeEphemeris: true }]) {
    assert.throws(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit }, ...bodies.slice(1)] }));
  }
  const parent = bodies.find(body => body.systemView)!;
  const view = parent.systemView as { memberIds: string[]; memberRadiiM: number[]; candidates: Record<string, unknown>[] };
  for (const systemView of [
    { ...view, candidates: [] },
    { ...view, memberRadiiM: [] },
    { ...view, memberRadiiM: view.memberRadiiM.map(radius => radius * 2) },
    { ...view, memberIds: view.memberIds.map(() => 'missing-moon') },
    { ...view, candidates: [{ ...view.candidates[0], memberPositionsM: [] }] },
    { ...view, candidates: [{ ...view.candidates[0], cameraToReference: [1,0,0,0,1,0,0,0,2] }] },
    { ...view, candidates: [{ ...view.candidates[0], minimumM: view.candidates[0].maximumM }] },
  ]) {
    assert.throws(() => parsePreparedWorldContext({ ...source,
      bodies: bodies.map(body => body === parent ? { ...body, systemView } : body) }));
  }
});

test('the Earth reference remains painted when its physical marker has faded at outer-system scale', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(SCENE_OBJECTS.map(object => [object.id,
      labelImportance(object.classification, object.discovery.featured, object.discovery.orientationReference ?? 0)])),
  });
  layer.setOverview(true);
  layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [0, 0, 233.27 * 149_597_870_700], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1100, principalOffsetPixels: [0, 0], widthPixels: 1280, heightPixels: 720 });
  const earth = layer.inspect().find(body => body.id === 'earth')!;
  assert.equal(annotationVisibility(earth.billboard, 'indicator'), 'hidden');
  assert.equal(annotationVisibility(earth.billboard, 'label'), '');
  assert.equal(earth.mover.style.visibility, '');
  assert.ok(Number(earth.mover.style.opacity) > 0);
  assert.equal(earth.orbit.some(paintedOrbitLeaf), false);
  layer.destroy();
});

test('prepared planetary systems retain identified moon paths and retire offscreen context annotations', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])) });
  layer.setOverview(true);
  for (const [planet, moon] of [['saturn', 'titan'], ['jupiter', 'europa'], ['uranus', 'titania']]) {
    const body = context.bodies.find(body => body.id === planet)!;
    layer.selectObject(planet);
    const publish = (radii: number) => layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
      pose: { positionM: [body.positionM[0], body.positionM[1], body.positionM[2] + radii * body.radiusM], orientationXyzw: [0, 0, 0, 1] } },
      { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
    // Orbit leaves are built on first use, so read the retained leaves after each publication.
    const orbit = () => layer.inspect().find(body => body.id === moon)!.orbit;
    // The planet spans about 20px, or 3.3% of this viewport: the moon system is readable.
    publish(40);
    assert.equal(orbit().some(paintedOrbitLeaf), true, `${planet} moon system at overview distance`);
    // Offscreen moons have no admitted annotation, so their context paths retire too.
    publish(2);
    assert.equal(orbit().some(paintedOrbitLeaf), false, `${planet} close-up`);
  }
  layer.destroy();
});

for (const orbitRenderer of ['bars', 'strokes'] as const) test(`${orbitRenderer} keeps body markers and orbit opacity independent of selection`, () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), parent = base.bodies[0]!;
  const unrelated = { ...base.bodies[1]!, positionM: [0, -100, 0] as const, orbit: orbit([0, -100, 0], 1) };
  const moons = ['moon-a', 'moon-b'].map((id, index) => ({ ...parent, id, name: id, radiusM: .1,
    positionM: [150, (index ? -1 : 1) * 50, 0], orbit: { ...orbit([150, (index ? -1 : 1) * 50, 0], 1),
      centerBodyId: index ? 'satellite-center' : parent.id, centerPositionM: parent.positionM } }));
  const context = parsePreparedWorldContext({ ...base, bodies: [parent, unrelated, ...moons],
    orbitCenters: { 'satellite-center': { centerBodyId: parent.id, positionM: parent.positionM } } });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])), orbitRenderer });
  layer.selectObject(parent.id); layer.setOverview(true); layer.previewSelection(null);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, 40], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 100, principalOffsetPixels: [0, 0] });
  const opacity = (id: string) => {
    const body = layer.inspect().find(body => body.id === id)!;
    const line = orbitRenderer === 'bars'
      ? Number(find(layer.root as unknown as FakeElement, 'contextOrbit', id).style.opacity)
      : Math.max(...body.orbit.filter(piece => piece.getAttribute('points')).map(piece => Number(piece.style.strokeOpacity)));
    return { marker: Number(body.mover.style.opacity), line };
  };
  const baseline = new Map(context.bodies.map(body => [body.id, opacity(body.id)]));
  for (const id of [parent.id, 'moon-a', 'moon-b']) {
    layer.previewSelection(id); document.defaultView.advance(200);
    for (const body of context.bodies) {
      const expected = 1;
      const actual = opacity(body.id), normal = baseline.get(body.id)!;
      assert.ok(normal.marker > 0); assert.ok(normal.line > 0);
      assert.ok(Math.abs((actual.marker / normal.marker) - (expected)) < 10 ** -1 / 2, `${id} -> ${body.id} marker`);
      assert.ok(Math.abs((actual.line / normal.line) - (1)) < 10 ** -1 / 2, `${id} -> ${body.id} orbit`);
    }
  }
  // Finishing the preview preserves the same orbit appearance in the system overview.
  layer.previewSelection(parent.id); document.defaultView.advance(200);
  const arrival = new Map(context.bodies.map(body => [body.id, opacity(body.id).line]));
  layer.previewSelection(undefined); document.defaultView.advance(200);
  for (const body of context.bodies) assert.ok(Math.abs(opacity(body.id).line - (arrival.get(body.id)!)) < 10 ** -2 / 2, `${opacity(body.id).line} is not close to ${arrival.get(body.id)!}`);
  layer.previewSelection(parent.id); document.defaultView.advance(200);
  const marker = layer.inspect().find(body => body.id === unrelated.id)!.billboard;
  marker.dataset.objectHovered = 'true'; host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(200); document.defaultView.advance(200);
  assert.ok(Math.abs(opacity(unrelated.id).marker - (baseline.get(unrelated.id)!.marker)) < 10 ** -2 / 2, `${opacity(unrelated.id).marker} is not close to ${baseline.get(unrelated.id)!.marker}`);
  assert.ok(opacity(unrelated.id).line > baseline.get(unrelated.id)!.line);
  marker.dataset.objectHovered = 'false'; host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(200); document.defaultView.advance(200);
  layer.previewSelection(null); document.defaultView.advance(200);
  for (const body of context.bodies) assert.deepEqual(opacity(body.id), baseline.get(body.id));
  // Selection stays independent of opacity when zooming out and back in.
  layer.previewSelection(parent.id);
  const publishDistance = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 100, principalOffsetPixels: [0, 0] });
  publishDistance(200);
  const farSelected = opacity(unrelated.id);
  layer.previewSelection(null);
  assert.deepEqual(opacity(unrelated.id), farSelected);
  layer.previewSelection(parent.id);
  publishDistance(40);
  assert.ok(Math.abs((opacity(unrelated.id).marker / baseline.get(unrelated.id)!.marker) - (1)) < 10 ** -1 / 2, `${(opacity(unrelated.id).marker / baseline.get(unrelated.id)!.marker)} is not close to ${1}`);
  assert.ok(Math.abs((opacity(unrelated.id).line / baseline.get(unrelated.id)!.line) - (1)) < 10 ** -1 / 2, `${(opacity(unrelated.id).line / baseline.get(unrelated.id)!.line)} is not close to ${1}`);
  layer.destroy();
});

// Parsed once for both systems below. The code is the same for every host: a planet with many moons and a star with planets.
let worldContext: Promise<ReturnType<typeof parsePreparedWorldContext>> | undefined;
for (const planet of ['saturn', 'trappist-1']) test(`${planet} moon orbits stay complete across selection, hover, flight and zoom`, async () => {
  worldContext ??= readFile(new URL('../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8').then(text => parsePreparedWorldContext(JSON.parse(text)));
  // The system alone is mounted: mounting the whole universe once per system grew with systems times bodies, and ~1,000 exoplanet
  // hosts (batch 1, 2026-09-29) made this test run for most of an hour.
  const universe = await worldContext, systemIds = new Set([planet, ...required([universe.focus, ...universe.bodies].find(body => body.id === planet)!.systemView).memberIds]);
  const context = { ...universe, bodies: universe.bodies.filter(body => systemIds.has(body.id)) };
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const viewport = { focalPixels: 1100, framingRadiusPixels: 200, principalOffsetPixels: [0, 0] as const,
    widthPixels: 1280, heightPixels: 720, visibleRect: null, detailHandoffDiameterPixels: 20 };
  const frame = SCENE_OBJECTS.find(object => object.id === planet)!.worldFrame;
  const target = systemViewTarget({ referenceFrame: required(frame).referenceFrame, epochJdTt: required(frame).epochJdTt,
    pose: { positionM: [0, 0, 1e15], orientationXyzw: [0, 0, 0, 1] } },
    required(frame), viewport, required(SYSTEM_VIEWS.get(planet)), systemFramingRect(viewport), 0, false, SYSTEM_RANGES.get(planet));
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])) });
  // The system's prepared members: bodies orbiting the planet, or a centre placed off it (a circumbinary planet).
  const memberIds = new Set(required([context.focus, ...context.bodies].find(body => body.id === planet)!.systemView).memberIds);
  const moons = layer.inspect().filter(body => memberIds.has(body.id));
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  layer.selectObject(planet); layer.setOverview(true);
  layer.publish(target, viewport);
  for (const zoom of [.8, 1, 1.4]) {
    layer.publish({ ...target, pose: { ...target.pose,
      positionM: target.pose.positionM.map((value, axis) => required(frame).originM[axis] + (value - required(frame).originM[axis]) * zoom) as [number, number, number],
    } }, viewport);
    for (const selection of [null, planet, [...memberIds][0], undefined]) {
      layer.previewSelection(selection);
      for (const active of [true, false]) {
        layer.setNavigationInFlight(active);
        const circle = find(root, 'contextBody', [...memberIds][0]!);
        circle.dataset.objectHovered = String(active);
        host.dispatchEvent(new Event('objecthoverchange'));
        document.defaultView.advance(16);
        const pieces = moons.flatMap(moon => moon.orbit.filter(paintedOrbitLeaf));
        assert.ok(pieces.length > 0);
        // A full orbit paints at full weight; a member drawn as a trail (an S-star) fades along its half orbit by design.
        const full = moons.filter(moon => context.bodies.find(body => body.id === moon.id)?.orbit?.fullTrail === true);
        assert.equal(full.flatMap(moon => moon.orbit.filter(paintedOrbitLeaf)).every(piece => orbitLeafWeight(piece) === 1), true);
      }
    }
  }
  expectRetained(root, nodes);
  layer.destroy();
});

test('initial Jupiter system framing makes the four large moons and their labels readable', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const viewport = { focalPixels: 1100, framingRadiusPixels: 200, principalOffsetPixels: [0, 0] as const,
    widthPixels: 1280, heightPixels: 720, visibleRect: null, detailHandoffDiameterPixels: 20 };
  const frame = SCENE_OBJECTS.find(object => object.id === 'jupiter')!.worldFrame;
  const target = systemViewTarget({ referenceFrame: required(frame).referenceFrame, epochJdTt: required(frame).epochJdTt,
    pose: { positionM: [0, 0, 1e15], orientationXyzw: [0, 0, 0, 1] } },
    required(frame), viewport, required(SYSTEM_VIEWS.get('jupiter')), systemFramingRect(viewport));
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(SCENE_OBJECTS.map(object => [object.id, labelImportance(object.classification)])),
  });
  layer.selectObject('jupiter'); layer.setOverview(true);
  layer.publish(target, viewport); document.defaultView.advance(200);
  for (const id of ['io', 'europa', 'ganymede', 'callisto']) {
    const moon = layer.inspect().find(body => body.id === id)!;
    assert.equal(moon.mover.style.visibility, '', `${id} circle`);
    assert.equal(moon.mover.style.visibility, '', `${id} label`);
    assert.equal(moon.orbit.some(paintedOrbitLeaf), true, `${id} orbit`);
  }
  layer.destroy();
});

test('the volume opacity profile has a constant plateau, a logarithmic smooth ramp and legacy opacity one', () => {
  const key = 'opacityProfile';
  const base = plan(1), profile = { model: 'logarithmic-distance' as const, nearOpacity: .12, fullOpacity: 1, fadeStartDistanceM: 100, fullDistanceM: 100_000 };
  const parsed = parsePreparedWorldContext({ ...base, volume: { ...base.volume, [key]: profile } });
  assert.deepEqual(parsed.volume[key], profile);
  for (const distance of [0, 1, 47, 100]) assert.equal(preparedVolumeOpacity(distance, parsed.volume[key]), .12);
  assert.ok(Math.abs(preparedVolumeOpacity(Math.sqrt(100 * 100_000), profile) - (.56)) < 10 ** -12 / 2, `${preparedVolumeOpacity(Math.sqrt(100 * 100_000), profile)} is not close to ${.56}`);
  for (const distance of [100_000, 1e20]) assert.equal(preparedVolumeOpacity(distance, profile), 1);
  assert.equal(preparedVolumeOpacity(47, base.volume[key]), 1);
  const samples = Array.from({ length: 101 }, (_, index) => preparedVolumeOpacity(100 * 1000 ** (index / 100), profile));
  assert.equal(samples.every((value, index) => index === 0 || value >= samples[index - 1]!), true);
  for (const invalid of [{ ...profile, model: 'linear' }, { ...profile, nearOpacity: -.01 }, { ...profile, fullOpacity: 1.01 },
    { ...profile, fullOpacity: Infinity }, { ...profile, nearOpacity: undefined }, { ...profile, fadeStartDistanceM: 0 },
    { ...profile, fullDistanceM: profile.fadeStartDistanceM }, { ...profile, runtimeExposure: true }]) {
    assert.throws(() => parsePreparedWorldContext({ ...base, volume: { ...base.volume, [key]: invalid } }), /opacity/i);
  }
});

test('prepared parent identities must form an acyclic hierarchy ending at the focus', () => {
  const source = plan(1), [a, b] = source.bodies;
  assert.throws(() => parsePreparedWorldContext({ ...source, bodies: [
    { ...a, orbit: { ...a!.orbit, centerBodyId: b!.id, centerPositionM: b!.positionM } },
    { ...b, orbit: { ...b!.orbit, centerBodyId: a!.id, centerPositionM: a!.positionM } },
  ] }), /hierarchy/);
});

test('satellite markers remain occluded by their parent when another detail object is selected', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), parent = source.bodies[0]!, child = source.bodies[1]!;
  const positionM = [100, 0, -20];
  const context = parsePreparedWorldContext({ ...source, bodies: [parent, { ...child, positionM,
    orbit: { ...child.orbit, centerBodyId: parent.id, centerPositionM: parent.positionM,
      verticesM: [positionM, ...orbitVertices(child.orbit!).slice(1)] } }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [100, 0, 20], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const root = layer.root as unknown as FakeElement;
  assert.equal(find(root, 'contextBody', 'mercury').style.visibility, '');
  assert.equal(find(root, 'contextBody', 'venus').style.visibility, 'hidden');
  assert.equal(declared(find(root, 'contextBody', 'venus'), 'pointerEvents'), 'none');
  layer.destroy();
});

test('a prepared object outside the navigation menu renders and selects using its retained asset', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => index === 0 ? { ...body, id: 'new-object', name: 'New object' } : body) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, 'new-object': sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  assert.equal(find(root, 'contextBody', 'new-object').dataset.objectNavigate, 'new-object');
  layer.selectObject('new-object');
  expectRetained(root, nodes);
  layer.destroy();
});

test('an orbitless prepared object renders and navigates without manufacturing orbital geometry', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), { orbit: _orbit, ...point } = source.bodies[0]!;
  const body = { ...point, id: 'future-object', name: 'Future object' };
  const context = parsePreparedWorldContext({ ...source, bodies: [body] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, 'future-object': sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const marker = find(root, 'contextBody', 'future-object'), selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  assert.equal(marker.style.visibility, '');
  marker.dispatchEvent(new Event('click'));
  assert.deepEqual(selections, ['future-object']);
  layer.selectObject('future-object');
  expectRetained(root, nodes);
  assert.equal(layer.inspect().every(body => body.orbit.length === 0), true);
  for (const orbit of [null, {}, { runtimeEphemeris: true }]) {
    assert.throws(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit }] }));
  }
  assert.throws(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, radiusM: undefined }] }));
  layer.destroy();
});

test('an orbit may centre on an orbitless prepared parent while remaining acyclic', () => {
  const source = plan(1), parent = source.bodies[0]!, child = source.bodies[1]!;
  const { orbit: _orbit, ...point } = parent;
  const parsed = parsePreparedWorldContext({ ...source, bodies: [point,
    { ...child, orbit: { ...child.orbit, centerBodyId: parent.id, centerPositionM: parent.positionM } }] });
  assert.equal(parsed.bodies[0]!.orbit, undefined);
  assert.equal(parsed.bodies[1]!.orbit!.centerBodyId, parent.id);
});

test('projects retained markers, culls focus-occluded bodies, and keeps physical scale invariant', () => {
  const near = mount(1), far = mount(1e12);
  const nearSun = find(near, 'contextBody', 'sun'), nearMercury = find(near, 'contextBody', 'mercury'), nearVenus = find(near, 'contextBody', 'venus');
  assert.ok(mover(nearSun).style.transform.includes('translate(30px,-20px)'));
  assert.equal(nearMercury.style.visibility, '');
  assert.equal(nearVenus.style.visibility, 'hidden');
  const nearOrbit = mounted.get(near)!.inspect().find(body => body.id === 'mercury')!.orbit.filter(element => element.style.visibility === '');
  assert.ok(nearOrbit.length > 0);
  for (const piece of nearOrbit) {
    const values = piece.style.transform.match(/-?[0-9.]+/g)!.map(Number);
    assert.ok(Math.abs(values[4]!) <= 400);
    assert.ok(Math.abs(values[5]!) <= 300);
  }
  assert.equal(mover(nearMercury).style.transform, mover(find(far, 'contextBody', 'mercury')).style.transform);
  assert.equal(nearOrbit.length, mounted.get(far)!.inspect().find(body => body.id === 'mercury')!.orbit.filter(element => element.style.visibility === '').length);
});

test('camera updates retain fixed stroke styles and only publish changed orbit picking policy', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const orbit = find(root, 'contextOrbit', 'mercury');
  const indicator = find(root, 'contextBody', 'mercury');
  const orbitWrites = mock.method(orbit.style as unknown as CSSStyleDeclaration, 'setProperty');
  const indicatorWrites = mock.method(indicator.style as unknown as CSSStyleDeclaration, 'setProperty');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  publish(1100); publish(1200);
  assert.equal(orbitWrites.mock.callCount(), 0);
  assert.equal(indicatorWrites.mock.callCount(), 0);
  assert.equal(orbit.dataset.objectNavigate, 'mercury');
  layer.setBodyVisibility({ orbitHidden: ['mercury'] });
  assert.equal(orbitWrites.mock.callCount(), 0);
  assert.equal(orbit.dataset.objectNavigate, undefined); orbitWrites.mock.resetCalls();
  publish(1250);
  assert.equal(orbitWrites.mock.callCount(), 0);
  layer.setBodyVisibility({ orbitHidden: [] });
  assert.equal(orbitWrites.mock.callCount(), 0);
  orbitWrites.mock.resetCalls();
  layer.setNavigationInFlight(true); layer.setNavigationInFlight(false);
  assert.equal(orbitWrites.mock.callCount(), 0);
  assert.equal(orbit.dataset.objectNavigate, 'mercury');
  layer.destroy();
});

test('distant ordinary bodies stop intercepting navigation while retained bodies remain selectable', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [source.bodies[0],
    { ...source.bodies[1], positionM: [0, 100, 0], orbit: orbit([0, 100, 0], 1) }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite },
    distantNavigation: { afterDistanceM: 500, nonNavigableIds: ['mercury'] } });
  const root = layer.root as unknown as FakeElement;
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  publish(400);
  assert.equal(find(root, 'contextBody', 'mercury').dataset.objectNavigate, 'mercury');
  assert.equal(find(root, 'contextBody', 'venus').dataset.objectNavigate, 'venus');
  publish(600);
  assert.equal(find(root, 'contextBody', 'mercury').dataset.objectNavigate, undefined);
  assert.equal(find(root, 'contextOrbit', 'mercury').dataset.objectNavigate, undefined);
  assert.equal(find(root, 'contextBody', 'venus').dataset.objectNavigate, 'venus');
  publish(400);
  assert.equal(find(root, 'contextBody', 'mercury').dataset.objectNavigate, 'mercury');
  layer.destroy();
});

test('orbit chords stop at the circular indicator on both sides of the centered body', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  const mercury = layer.inspect().find(body => body.id === 'mercury')!;
  assert.equal(mercury.mover.style.visibility, '');
  assert.equal(declared(mercury.billboard, 'width'), '16px');
  assert.deepEqual(mercury.center, [70, -20]);
  assert.ok(mover(mercury.billboard).style.transform.includes('translate(70px,-20px)'));
  const edges: number[][] = [];
  for (const piece of mercury.orbit.filter(piece => piece.style.visibility === '')) {
    const [dx, dy, , , x, y] = piece.style.transform.slice(7, -1).split(',').map(Number);
    const t = Math.max(0, Math.min(1, ((70 - x) * dx + (-20 - y) * dy) / (dx * dx + dy * dy)));
    assert.ok(Math.hypot(x + dx * t - 70, y + dy * t + 20) >= 8 - 1e-5);
    for (const [ex, ey] of [[x, y], [x + dx, y + dy]]) {
      if (Math.abs(Math.hypot(ex - 70, ey + 20) - 8) < 1e-5) edges.push([ex, ey]);
    }
  }
  assert.equal(edges.some(([, y]) => y > -20), true);
  assert.equal(edges.some(([, y]) => y < -20), true);
  assert.equal(find(root, 'contextBody', 'venus').style.visibility, 'hidden');
  layer.destroy();
});

test('body circles fade with apparent size, remain clickable, and reuse their nodes', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const indicator = find(root, 'contextBody', 'mercury');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(100);
  assert.equal(annotationVisibility(indicator, 'indicator'), 'hidden');
  assert.equal(declared(indicator, 'pointerEvents'), 'none');
  publish(140);
  assert.ok(Number(indicator.parentNode!.style.opacity) > 0);
  assert.ok(Number(indicator.parentNode!.style.opacity) < 1);
  publish(200);
  assert.ok(Number(indicator.parentNode!.style.opacity) > 0.98);
  assert.ok(Number(indicator.parentNode!.style.opacity) <= 1);
  assert.equal(indicator.dataset.objectNavigate, 'mercury');
  const selections: string[] = [];
  root.parentNode!.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  indicator.dispatchEvent(new Event('click'));
  assert.deepEqual(selections, ['mercury']);
  expectRetained(root, nodes);
  layer.destroy();
});

test('orbit and circle keep a one-pixel stroke across zoom and physical system size', () => {
  for (const scale of [1, 1e12]) {
    const root = mount(scale), layer = mounted.get(root)!;
    const strokeAt = (extent: number) => {
      layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
        pose: { positionM: [0, 0, 80000 / extent * scale], orientationXyzw: [0, 0, 0, 1] } },
        { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 5000, heightPixels: 5000 });
      const mercury = layer.inspect().find(body => body.id === 'mercury')!;
      const marker = mercury.billboard as unknown as FakeElement;
      const orbitRoot = (mercury.orbit[0].parentNode as unknown as FakeElement).parentNode!;
      assert.equal(marker.style['--context-line-width'], undefined);
      assert.equal(orbitRoot.style['--context-line-width'], undefined);
      assert.equal(find(root, 'contextBody', 'sun').style['--context-line-width'], undefined);
      return CONTEXT_LINE_WIDTH;
    };
    assert.equal(strokeAt(512), 1);
    assert.equal(strokeAt(Math.sqrt(64 * 512)), 1);
    assert.ok(Math.abs(strokeAt(64) - (1)) < 10 ** -2 / 2, `${strokeAt(64)} is not close to ${1}`);
    assert.equal(strokeAt(24), 1);
    const crowded = layer.inspect().find(body => body.id === 'mercury')!;
    assert.equal(crowded.indicatorShown, false);
    assert.equal(crowded.orbit.some(piece => piece.style.visibility === ''), false);
    assert.equal(strokeAt(8), 1);
    assert.equal(layer.inspect().find(body => body.id === 'mercury')!.orbit.every(piece => piece.style.visibility === 'hidden'), true);
    layer.destroy();
  }
});

test('orbit settings preserve admitted captions and their placements', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const labels = () => layer.inspect().filter(body => body.labelShown).map(body => [body.id, body.labelRect]);
  const before = structuredClone(labels());
  assert.ok(before.length > 0);
  layer.setBodyVisibility({ orbitHidden: ['mercury', 'venus'] });
  assert.deepEqual(labels(), before);
  assert.equal(layer.inspect().flatMap(body => body.orbit).some(paintedOrbitLeaf), false);
  layer.destroy();
});

test('overlapping circles retain selection priority and reappear when separated', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 1000; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => ({
    id: body.id, name: body.name, color: body.color, radiusM: 0.1, positionM: [400 + index * 10, 0, 0],
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const mercury = find(root, 'contextBody', 'mercury'), venus = find(root, 'contextBody', 'venus');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(2000);
  assert.equal(mercury.style.visibility, '');
  assert.equal(annotationVisibility(venus, 'indicator'), 'hidden');
  assert.equal(declared(venus, 'pointerEvents'), 'none');
  const venusMarker = find(root, 'contextBody', 'venus');
  // Venus's dot is 2 px from Mercury's, under it (marker-declutter.ts): it is not drawn, and follows no camera sample.
  assert.equal(venusMarker.style.visibility, 'hidden');
  let writes = 0;
  for (const node of [mover(venusMarker)]) {
    let transform = node.style.transform;
    Object.defineProperty(node.style, 'transform', {
      get: () => transform, set: value => { writes++; transform = value; },
    });
  }
  publish(2200); publish(2500);
  assert.equal(writes, 0);
  // Selected, it draws over Mercury and follows the camera again.
  layer.selectObject('venus'); publish(2000);
  assert.equal(writes, 1);
  assert.deepEqual(billboardCenter(venus), [82, 0]);
  assert.equal(venusMarker, venus);
  assert.equal(venus.style.visibility, '');
  assert.equal(annotationVisibility(mercury, 'indicator'), 'hidden');
  publish(160);
  assert.equal(mercury.style.visibility, '');
  assert.equal(venus.style.visibility, '');
  expectRetained(root, nodes);
  layer.destroy();
});

for (const [higher, lower] of [
  ['planet', 'dwarf-planet'], ['planet', 'comet'], ['planet', 'asteroid'],
  ['dwarf-planet', 'comet'], ['dwarf-planet', 'asteroid'], ['comet', 'asteroid'],
]) test(`${higher} annotations outrank ${lower} through zoom, even after the lower class was visible first`, () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 1000; host.append(before);
  const source = plan(1);
  const objects = [lower, higher].map(classification => SCENE_OBJECTS.find(object => object.classification === classification)!);
  const context = parsePreparedWorldContext({ ...source,
    system: { fadeOutStartDistanceM: 10_000, hiddenDistanceM: 1e30 },
    bodies: objects.map((object, index) => ({
    ...source.bodies[0], id: object.id, name: object.name, radiusM: .1,
    positionM: [400 + index * 30, 0, 0],
    orbit: { ...source.bodies[0].orbit, verticesM: orbit([100, 0, 0], 1).verticesM.map(([x, y, z]) => [x + 300 + index * 30, y, z]) },
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries(['sun', ...objects.map(object => object.id)].map(id => [id, sprite])),
    annotationPriorities: Object.fromEntries(objects.map(object => [object.id, labelImportance(object.classification)])),
  });
  layer.setOverview(true);
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const [minor, major] = objects.map(object => layer.inspect().find(body => body.id === object.id)!);
  const publish = (distance: number) => {
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
      pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
      { focalPixels: 400, principalOffsetPixels: [0, 0] });
    document.defaultView.advance(200);
  };
  // Selection initially gives the lower class the retained visibility bonus.
  layer.previewSelection(objects[0].id); publish(1000);
  assert.equal(annotationVisibility(minor.billboard, 'indicator'), '');
  layer.previewSelection(null);
  const distances = Array.from({ length: 61 }, (_, index) => 400 + index * 20);
  for (const distance of [...distances, ...distances.toReversed()]) {
    publish(distance);
    assert.equal(major.mover.style.visibility, '');
    assert.equal(major.mover.style.visibility, '');
    for (const body of [minor, major]) {
      assert.equal(body.mover.style.visibility, '');
      // Ranking decides captions and circles; a named body always keeps the path beside it.
      if (body.labelShown) assert.equal(body.orbit.some(piece => piece.style.visibility === ''), true);
      assert.equal(body.indicatorShown, body.labelShown);
    }
  }
  publish(1000);
  assert.equal(annotationVisibility(minor.billboard, 'indicator'), 'hidden');
  // Direct interaction can still reveal a lower-priority body and its label.
  (minor.billboard as unknown as FakeElement).dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange')); publish(1000);
  assert.equal(annotationVisibility(minor.billboard, 'indicator'), '');
  assert.equal(annotationVisibility(minor.billboard, 'indicator'), '');
  delete (minor.billboard as unknown as FakeElement).dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  layer.previewSelection(objects[0].id); publish(1000);
  assert.equal(annotationVisibility(minor.billboard, 'indicator'), '');
  assert.equal(annotationVisibility(minor.billboard, 'indicator'), '');
  layer.previewSelection(null); publish(1000);
  assert.equal(major.mover.style.visibility, '');
  expectRetained(root, nodes);
  layer.destroy();
});

test('the Sun circle and label remain visible after all planetary context fades at maximum range', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, camera: { ...source.camera, maximumDistanceM: 1e12 },
    system: { fadeOutStartDistanceM: 100, hiddenDistanceM: 1000 } });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  for (const distance of [10000, context.camera.maximumDistanceM]) {
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
      pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
      { focalPixels: 400, principalOffsetPixels: [30, -20] });
    assert.equal(root.hidden, false);
    assert.equal(find(root, 'contextBody', 'sun').style.visibility, '');
    assert.equal(find(root, 'contextBody', 'sun').parentNode!.style.opacity, '1');
    assert.equal(find(root, 'contextLabel', 'sun').style.visibility, '');
    assert.equal(find(root, 'contextLabel', 'sun').dataset.objectNavigate, 'sun');
    assert.equal(find(root, 'contextBody', 'mercury').style.visibility, 'hidden');
    assert.equal(find(root, 'contextLabel', 'mercury').style.visibility, 'hidden');
    assert.equal(layer.inspect().flatMap(body => body.orbit).every(piece => piece.style.visibility === 'hidden'), true);
  }
  expectRetained(root, nodes);
  layer.destroy();
});

test('retired bodies stop receiving zoom writes and resume with current picking after indicator toggles', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } }, viewport);
  const mercury = layer.inspect().find(body => body.id === 'mercury')!;
  publish(1e31); root.ownerDocument.defaultView.advance(200);
  const writes: string[] = [];
  const group = find(root, 'contextGroup', 'mercury');
  for (const node of [mover(group), group, ...all(group)]) for (const key of Object.keys(node.style)) {
    let value = node.style[key];
    if (typeof value !== 'string') continue;
    Object.defineProperty(node.style, key, { get: () => value, set: next => { writes.push(key); value = next; }, configurable: true });
  }
  publish(2e31); publish(3e31);
  assert.deepEqual(writes, []);
  assert.equal(find(root, 'contextLabel', 'sun').dataset.objectNavigate, 'sun');
  assert.equal(mercury.billboard.dataset.objectNavigate, undefined);
  assert.deepEqual(layer.backgroundExclusionRects(), [...layer.labelExclusionRects(),
    { left: 22, right: 38, top: -28, bottom: -12 }]); // Only the Sun's caption and 16 px circle remain.
  publish(1000);
  assert.ok(writes.length > 0);
  assert.equal(mercury.billboard.dataset.objectNavigate, 'mercury');
  assert.equal(mercury.orbit.some(piece => piece.style.visibility === ''), true);
  // Hiding overlays before retirement must not restore their old visible state
  // when the controls are re-enabled at galaxy distance.
  layer.setNavigationInFlight(true); publish(1e31); publish(2e31);
  layer.setNavigationInFlight(false);
  assert.equal(mercury.mover.style.visibility, 'hidden');
  assert.equal(mercury.orbit.every(piece => piece.style.visibility === 'hidden'), true);
  // A flight holds keyboard and accessibility state instead of disabling and
  // restoring every body, so the retired marker keeps the target it committed
  // while it was drawn; its hidden visibility keeps it out of the tab order.
  assert.equal(mercury.billboard.dataset.objectNavigate, 'mercury');
  publish(1000);
  assert.equal(mercury.billboard.dataset.objectNavigate, 'mercury');
  expectRetained(root, nodes);
  layer.destroy();
});

test('retired depth groups defer rotation and selection writes until same-pose re-entry', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const publish = (z: number, orientationXyzw: OrientationXyzw = [0, 0, 0, 1]) => layer.publish({
    referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, z], orientationXyzw },
  }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(1e31); root.ownerDocument.defaultView.advance(200);
  let writes = 0;
  for (const id of ['mercury', 'venus']) {
    const style = mover(find(root, 'contextGroup', id)).style;
    let zIndex = style.zIndex;
    Object.defineProperty(style, 'zIndex', { get: () => zIndex, set: value => { writes++; zIndex = value; } });
  }
  const halfTurn: OrientationXyzw = [0, 1, 0, 0];
  publish(-1e31, halfTurn);
  layer.selectObject('venus'); publish(-2e31, halfTurn);
  assert.equal(writes, 0);
  const depth = (id: string) => Number(mover(find(root, 'contextGroup', id)).style.zIndex);
  assert.ok(depth('sun') < 0);
  // Distance alone resumes the system; the cached orientation/selection are
  // unchanged, so re-entry itself must invalidate the depth publication scope.
  publish(-1000, halfTurn);
  assert.ok(writes > 0);
  assert.equal(depth('venus'), 0);
  // Behind the selection the order is the fixed one: equal priorities, so the larger Sun stacks over Mercury.
  assert.ok(depth('sun') > depth('mercury'));
  assert.ok(depth('mercury') < 0);
  expectRetained(root, nodes);
  layer.destroy();
});

test('dolly motion leaves depth styles untouched while selection and rotation still reorder retained groups', () => {
  const root = mount(1), layer = mounted.get(root)!;
  let writes = 0;
  for (const id of ['sun', 'mercury', 'venus']) {
    const style = mover(find(root, 'contextGroup', id)).style;
    let zIndex = style.zIndex;
    Object.defineProperty(style, 'zIndex', { get: () => zIndex, set: value => { writes++; zIndex = value; } });
  }
  const publish = (distance: number, orientationXyzw: OrientationXyzw = [0, 0, 0, 1]) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  for (const distance of [200, 2000, 1e8, 2e8]) publish(distance);
  assert.equal(writes, 0);
  layer.selectObject('venus'); publish(2000);
  assert.ok(writes > 0);
  // Venus is occluded here. Its depth style is deferred until it can draw.
  assert.equal(find(root, 'contextGroup', 'venus').style.visibility, 'hidden');
  assert.ok(Number(mover(find(root, 'contextGroup', 'sun')).style.zIndex) > 3);
  writes = 0; publish(3000); assert.equal(writes, 0);
  publish(-3000, [0, 1, 0, 0]);
  assert.ok(writes > 0);
  assert.equal(mover(find(root, 'contextGroup', 'venus')).style.zIndex, '0');
  assert.ok(Number(mover(find(root, 'contextGroup', 'mercury')).style.zIndex) < 0);
  assert.equal(find(root, 'contextGroup', 'sun').style.visibility, '');
  layer.destroy();
});

test('selection transfers the detail handoff to the destination while retaining every orbit and marker', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const camera: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, 20], orientationXyzw: [0, 0, 0, 1] } } as const;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] } as const;
  layer.publish(camera, viewport);
  const marker = find(root, 'contextBody', 'mercury');
  assert.equal(marker.style.visibility, '');
  assert.equal(marker.dataset.objectNavigate, 'mercury');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  marker.dispatchEvent(new Event('click'));
  assert.deepEqual(selections, ['mercury']);
  layer.selectObject('mercury'); layer.publish(camera, viewport);
  assert.equal(marker.style.visibility, 'hidden');
  assert.equal(declared(marker, 'pointerEvents'), 'none');
  marker.dispatchEvent(new Event('click'));
  assert.deepEqual(selections, ['mercury']);
  expectRetained(root, nodes);
  assert.throws(() => layer.selectObject('unprepared'), /unavailable/);
  layer.selectObject('sun'); layer.publish(camera, viewport);
  assert.equal(marker.style.visibility, '');
  layer.destroy();
});

test('past the system scope only the star is drawn and mounted, and its members return with the system scope', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const publish = () => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 2000], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const drawn = () => layer.inspect().filter(body => body.mover.style.visibility === '').map(body => body.id);
  publish();
  const inside = drawn();
  assert.ok(inside.includes('sun') && inside.length > 1, `inside the system its members draw, got ${inside.join(', ')}`);
  // The application's overview scope moved past the system (the Milky Way's): the system retires, its star stays.
  layer.setSystemRetired(true); publish(); publish();
  assert.deepEqual(drawn(), ['sun']);
  // Retired, the members leave the page: their marker groups are not mounted hidden.
  const attached = () => layer.inspect().filter(body => body.mover.parentNode).map(body => body.id);
  assert.deepEqual(attached(), ['sun']);
  layer.setSystemRetired(false); publish(); publish();
  assert.deepEqual(drawn(), inside);
  assert.deepEqual(attached().filter(id => inside.includes(id)), inside);
  layer.destroy();
});

test('crowded labels keep selection and hover priority, disable hidden targets, and reappear with clearance', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => ({
    id: body.id, name: body.name, color: body.color, radiusM: 1, positionM: [400 + index * 10, 0, 0],
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const mercury = find(root, 'contextLabel', 'mercury'), venus = find(root, 'contextLabel', 'venus');
  const publish = (focalPixels = 400) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [400, 0, 2000], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels, principalOffsetPixels: [0, 0] });
  const shown = () => [mercury, venus].filter(label => annotationVisibility(label, 'label') === '').map(label => label.dataset.contextName);
  publish(); assert.deepEqual(shown(), ['Mercury']);
  assert.equal(declared(venus, 'pointerEvents'), 'none');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  // The hidden caption has no hit rectangle, and Venus's dot, under Mercury's, is not drawn: the spot navigates to Mercury.
  assert.equal(layer.inspect().find(body => body.id === 'venus')!.labelRect, null);
  assert.equal(find(root, 'contextBody', 'venus').style.visibility, 'hidden');
  venus.dispatchEvent(new Event('click')); assert.deepEqual(selections, []);
  // Venus's dot was under Mercury's, so it was never drawn or measured: selected, it draws, and its caption follows once
  // measured, a frame later.
  layer.selectObject('venus'); publish(); publish(); assert.deepEqual(shown(), ['Venus']);
  find(root, 'contextBody', 'mercury').dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  publish(); assert.deepEqual(shown(), ['Mercury']); // Hover takes priority over selection.
  delete find(root, 'contextBody', 'mercury').dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  layer.selectObject('sun');
  publish(8800); assert.deepEqual(shown(), ['Mercury']);
  publish(10000); assert.deepEqual(shown(), ['Mercury', 'Venus']);
  publish(9200); assert.deepEqual(shown(), ['Mercury', 'Venus']);
  publish(8800); assert.deepEqual(shown(), ['Mercury']);
  publish(9200); assert.deepEqual(shown(), ['Mercury', 'Venus']);
  assert.equal(mercury.measurements, 1); assert.equal(venus.measurements, 1);
  expectRetained(root, nodes);
  layer.destroy();
});


for (const interaction of ['pointer', 'keyboard']) test(`a hidden moon annotation reveals together on ${interaction} interaction`, () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [
    { ...source.bodies[0], positionM: [400, 0, 0], orbit: orbit([400, 0, 0], 1) },
    { ...source.bodies[1], positionM: [460, 0, 0], radiusM: .1,
      orbit: { ...orbit([460, 0, 0], 1), centerBodyId: 'mercury', centerPositionM: [400, 0, 0] } },
  ] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.setBodyVisibility({ orbitHidden: ['venus'] });
  layer.setBodyVisibility({ labelHidden: ['venus'] });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const circle = find(root, 'contextBody', 'venus'), label = find(root, 'contextLabel', 'venus');
  assert.equal(annotationVisibility(circle, 'indicator'), 'hidden');
  assert.equal(annotationVisibility(label, 'label'), 'hidden');
  for (const active of [true, false]) {
    if (interaction === 'pointer') circle.dataset.objectHovered = String(active);
    else Object.assign(document, { activeElement: active ? circle : null });
    host.dispatchEvent(new Event(interaction === 'pointer' ? 'objecthoverchange' : active ? 'focusin' : 'focusout'));
    document.defaultView.advance(16); document.defaultView.advance(200);
    assert.equal(annotationVisibility(circle, 'indicator'), active ? '' : 'hidden');
    assert.equal(annotationVisibility(label, 'label'), active ? '' : 'hidden');
    if (active) assert.equal(label.dataset.contextIndicatorHovered, 'true');
  }
  expectRetained(root, nodes);
  layer.destroy();
});

test('an in-frame circle and caption stay visible and constrained at the viewport edge', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0], positionM: [990, 740, 0], orbit: orbit([990, 740, 0], 1) }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.setBodyVisibility({ orbitHidden: ['mercury'] });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const root = layer.root as unknown as FakeElement;
  const circle = find(root, 'contextBody', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  assert.equal(annotationVisibility(circle, 'indicator'), '');
  assert.equal(annotationVisibility(label, 'label'), '');
  const beforeHover = captionPosition(label);
  circle.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); document.defaultView.advance(200);
  assert.equal(annotationVisibility(circle, 'indicator'), '');
  assert.equal(annotationVisibility(label, 'label'), '');
  const [x, y] = captionPosition(label);
  assert.deepEqual(([x, y]), beforeHover);
  assert.ok(x >= -396); assert.ok((x + label.dataset.contextName.length * 6) <= 396);
  assert.ok(y >= -296); assert.ok((y + 14) <= 296);
  layer.destroy();
});

test('the Sun caption stays above its marker as orbit strokes cross during zoom', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const label = find(root, 'contextLabel', 'sun');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1]} },
    {focalPixels: 400, principalOffsetPixels: [0, 0]});
  publish(1200);
  assert.equal(annotationVisibility(label, 'label'), '');
  publish(4000);
  assert.equal(annotationVisibility(label, 'label'), '');
  assert.deepEqual(captionPosition(label), [-9, -26]);
  publish(1200);
  assert.equal(annotationVisibility(label, 'label'), '');
  publish(8000);
  assert.equal(annotationVisibility(label, 'label'), '');
  assert.deepEqual(captionPosition(label), [-9, -26]);
  layer.destroy();
});

for (const { y, extent, weight, shown } of [
  { reason: 'an orbit clears the visible stroke', y: 81.5, extent: 200, weight: 1, shown: true },
  { reason: 'a visible orbit crosses the text', y: 50, extent: 200, weight: 1, shown: true },
  { reason: 'the crossing orbit trail is faded away', y: 50, extent: 200, weight: .01, shown: true },
  { reason: 'a small resolved orbit still crosses the text', y: 50, extent: 65, weight: 1, shown: true },
  { reason: 'the orbit is unresolved at this zoom', y: 10, extent: 10, weight: 1, shown: true },
]) test(`the Sun caption remains readable across orbit strokes when $reason`, () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), body = source.bodies[0], positionM = [-extent, -extent, 0];
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...body, positionM, orbit: { ...body.orbit,
    verticesM: [positionM, [-extent, y, 0], [extent, y, 0], [extent, -extent, 0],
      positionM, [-extent, y, 0], [extent, y, 0], [extent, -extent, 0]], trail: Array(8).fill(weight),
  } }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.setOverview(true);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const label = find(layer.root as unknown as FakeElement, 'contextLabel', 'sun');
  assert.equal(annotationVisibility(label, 'label'), shown ? '' : 'hidden');
  assert.equal(declared(label, 'pointerEvents'), 'none');
  if (shown) assert.deepEqual(captionPosition(label), [-9, -26]);
  layer.destroy();
});


test('switching to the Solar System card immediately reveals the Sun ring without another camera frame', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 500], orientationXyzw: [0, 0, 0, 1]} },
    {focalPixels: 400, principalOffsetPixels: [0, 0]});
  const ring = find(root, 'contextBody', 'sun');
  assert.equal(annotationVisibility(ring, 'indicator'), 'hidden');
  const proxyOpacity = ring.parentNode!.style.opacity;
  layer.setOverview(true);
  assert.equal(annotationVisibility(ring, 'indicator'), '');
  assert.equal(ring.dataset.objectNavigate, 'sun');
  assert.equal(ring.parentNode!.style.opacity, proxyOpacity);
  layer.setOverview(false);
  assert.equal(annotationVisibility(ring, 'indicator'), 'hidden');
  layer.destroy();
});


for (const closed of [true, false]) test(`crowding retires complete annotations and their orbits, and the dots under another body's (closed=${closed})`, () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => {
    const positionM = [20 + index * 10, 0, 0];
    return { ...body, radiusM: .1, positionM, orbit: { ...body.orbit,
      verticesM: [positionM, [0,500,0], [-500,0,0], [0,-500,0], [500,0,0], [0,500,0], [-500,0,0], [0,-500,0]],
      trail: closed ? body.orbit!.trail : body.orbit!.trail.map(() => .75) } };
  }) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite} });
  layer.setOverview(true);
  const publish = (distance: number) => layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1]}}, {focalPixels: 400, principalOffsetPixels: [0, 0]});
  publish(2000);
  const entries = layer.inspect();
  assert.equal(entries[0].mover.style.visibility, '');
  for (const body of entries.slice(1)) {
    assert.equal(body.indicatorShown, false);
    assert.equal(body.labelShown, false);
    // Mercury's dot, 4 px from the Sun's, clears it; Venus's, 2 px further, is under Mercury's (marker-declutter.ts).
    assert.equal(body.mover.style.visibility, body.id === 'venus' ? 'hidden' : '');
    assert.equal(declared(body.billboard, 'pointerEvents'), 'none');
    // Too far for this camera to name any of them: no captions, and no unidentified paths.
    assert.equal(body.orbit.some(piece => piece.style.visibility === ''), false);
  }
  publish(100);
  for (const body of entries.slice(1)) {
    assert.equal(body.mover.style.visibility, '');
    if (body.labelShown) assert.equal(body.orbit.some(piece => piece.style.visibility === ''), true);
  }
  layer.destroy();
});

for (const closed of [true, false]) test(`admitted annotations retain physical alpha while orbit extent controls optional line paint (closed=${closed})`, () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 5000; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0],
    positionM: [500, 0, 0], radiusM: .1,
    orbit: { ...source.bodies[0].orbit,
      verticesM: [[500,0,0], [550,50,0], [600,0,0], [550,-50,0], [500,0,0], [550,50,0], [600,0,0], [550,-50,0]],
      trail: Array(8).fill(closed ? 1 : .75) },
  }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite} });
  layer.setOverview(true);
  const nodes = all(layer.root as unknown as FakeElement);
  const body = layer.inspect().find(entry => entry.id === 'mercury')!;
  const orbitRoot = find(layer.root as unknown as FakeElement, 'contextOrbit', 'mercury');
  for (const extent of [160, 80, 48, 32, 24, 16, 8, 16, 24, 32, 48, 80, 160]) {
    layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
      pose: {positionM: [0, 0, 40000 / extent], orientationXyzw: [0, 0, 0, 1]}},
      {focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 5000, heightPixels: 5000});
    // Culled indicators retain their last paint values; visible fades still match exactly.
    assert.ok(Number(body.mover.style.opacity) >= Number(orbitRoot.style.opacity));
    assert.equal(body.orbit.some(piece => piece.style.visibility === ''), body.labelShown && extent > 12);
    // Body-parent separation is five times this fixture's tiny orbit extent.
    // Indicator readability follows that separation, independently of orbit paint.
    assert.equal(body.indicatorShown, body.labelShown);
    assert.equal(declared(body.billboard, 'pointerEvents'), 'none');
  }
  expectRetained(layer.root as unknown as FakeElement, nodes);
  layer.destroy();
});

test('an offscreen context body keeps the ring the camera crosses; explicit selection retains the clipped path', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0],
    positionM: [2000, 0, 0],
    orbit: { ...source.bodies[0].orbit,
      verticesM: [[2000,0,0], [100,100,0], [-100,100,0], [-200,0,0], [-100,-100,0], [100,-100,0], [1000,-50,0], [1500,-20,0]],
      trail: Array(8).fill(.75) },
  }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite} });
  layer.setOverview(true);
  layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1]}},
    {focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600});
  const body = layer.inspect().find(entry => entry.id === 'mercury')!;
  assert.equal(body.mover.style.visibility, 'hidden');
  // The body is off screen and cannot own an annotation, but its path still crosses
  // the viewport and remains useful in the ordinary context view.
  assert.equal(body.orbit.some(piece => piece.style.visibility === ''), true);
  layer.setOverview(false); layer.selectObject('mercury');
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  assert.equal(body.orbit.some(piece => piece.style.visibility === ''), true);
  layer.destroy();
});

test('a label cannot cover a neighbouring circle even when the two labels fit', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => ({
    id: body.id, name: body.name, color: body.color, radiusM: .1, positionM: [100 + index * 80, 0, 0],
  })) });
  const layer = mountTestContext({host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite}});
  layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 400], orientationXyzw: [0, 0, 0, 1]}}, {focalPixels: 400, principalOffsetPixels: [0, 0]});
  const entries = layer.inspect();
  assert.ok(entries.filter(body => body.labelShown).length > 1);
  for (const body of entries.filter(body => body.labelShown)) {
    const [x, y] = captionPosition(body.billboard);
    const width = captionName(body.billboard).length * 6;
    for (const other of entries.filter(other => other !== body && other.indicatorShown)) {
      const [cx, cy] = other.center;
      assert.ok(Math.hypot(Math.max(x, Math.min(x + width, cx)) - cx,
        Math.max(y, Math.min(y + 14, cy)) - cy) >= 12);
    }
  }
  layer.destroy();
});

test('one retained focus label and locator survive system retirement at their physical galaxy position', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1);
  const context = parsePreparedWorldContext({ ...base,
    focus: { ...base.focus, id: 'anchor', name: 'Anchor' },
    bodies: base.bodies.map(body => ({ ...body, orbit: { ...body.orbit, centerBodyId: 'anchor' } })),
    system: { fadeOutStartDistanceM: 1000, hiddenDistanceM: 10000 } });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { anchor: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement;
  const focus = layer.inspect().find(body => body.id === 'anchor')!;
  const label = focus.billboard as unknown as FakeElement, locator = focus.billboard as unknown as FakeElement;
  const retained = all(host);
  assert.equal(label.dataset.contextName, 'Anchor');
  assert.equal(mover(label).parentNode, null);
  assert.deepEqual(mover(label).children, [label]);
  // The sprite alone scales; the ring stays a pseudo of the unscaled marker and the caption is a retained element
  // placed by transform (world-context-marker-paint.ts).
  assert.deepEqual(label.children.map(child => child.tagName), ['i', 'u']); assert.equal(label.children[0]!.children.length, 0); assert.equal(label, locator);
  assert.deepEqual(all(host).filter(node => node.dataset.contextLabel === 'anchor'), []);
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const camera = (distance: number): {referenceFrame: string; epochJdTt: number; pose: {positionM: [number, number, number]; orientationXyzw: OrientationXyzw}} => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } });
  // The caption remains visible when the intermediate orbit crosses it.
  for (const [distance, locatorOpacity, captionVisible] of [[50, 0, false], [Math.sqrt(1000 * 10000), 1, true], [8000, 1, true], [1e21, 1, true], [50, 0, false]] as const) {
    layer.publish(camera(distance!), viewport);
    document.defaultView.advance(200);
    if (locatorOpacity) assert.ok(Math.abs(Number(locator.parentNode!.style.opacity) - (1)) < 10 ** -2 / 2, `${Number(locator.parentNode!.style.opacity)} is not close to ${1}`);
    assert.equal(annotationVisibility(locator, 'indicator'), locatorOpacity! > 0 ? '' : 'hidden');
    assert.equal(annotationVisibility(label, 'label'), captionVisible ? '' : 'hidden');
    expectRetained(host, retained);
  }
  const distant = camera(1e21);
  distant.pose.positionM = [-1e20, 5e19, 1e21];
  layer.publish(distant, viewport);
  document.defaultView.advance(200);
  assert.equal(layer.inspect().filter(body => body.id !== 'anchor').every(body => body.mover.style.visibility === 'hidden'), true);
  assert.equal(mover(label).hidden, false); assert.equal(mover(label).parentNode!.hidden, false);
  assert.equal(annotationVisibility(label, 'label'), ''); assert.ok(Math.abs(Number(label.parentNode!.style.opacity) - (1)) < 10 ** -2 / 2, `${Number(label.parentNode!.style.opacity)} is not close to ${1}`);
  assert.equal(annotationVisibility(locator, 'indicator'), ''); assert.ok(Math.abs(Number(locator.parentNode!.style.opacity) - (1)) < 10 ** -2 / 2, `${Number(locator.parentNode!.style.opacity)} is not close to ${1}`);
  assert.deepEqual(billboardCenter(locator), [70, 0]);
  assert.deepEqual(captionPosition(label), [52, -26]);
  assert.equal(locator.dataset.objectNavigate, 'anchor');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  label.dispatchEvent(new Event('click')); assert.deepEqual(selections, ['anchor']);
  // Roll moves the physical projected location; a reversed view must cull it.
  distant.pose.orientationXyzw = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  layer.publish(distant, viewport);
  assert.notDeepEqual(billboardCenter(locator), [70, -40]);
  const poses: PhysicalCameraPose[] = [
    { ...camera(1e21).pose, orientationXyzw: [0, 1, 0, 0] },
    { ...camera(1e21).pose, positionM: [-2e21, 0, 1e21] },
  ];
  for (const pose of poses) {
    layer.publish({ ...distant, pose }, viewport);
    assert.equal(annotationVisibility(locator, 'indicator'), 'hidden'); assert.equal(annotationVisibility(label, 'label'), 'hidden');
    assert.equal(declared(locator, 'pointerEvents'), 'none'); assert.equal(declared(label, 'pointerEvents'), 'none');
    label.dispatchEvent(new Event('click')); assert.deepEqual(selections, ['anchor']);
  }
  layer.destroy(); assert.deepEqual(host.children, [before]);
  label.dispatchEvent(new Event('click')); assert.deepEqual(selections, ['anchor']);
  assert.equal(label.measurements, 1, 'camera publication must never remeasure label layout');
});

test('the selected moon family shows readable labels, then fades at system distance', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), parent = { ...base.bodies[0]!, radiusM: 5 }, satellite = base.bodies[1]!;
  const positionM = [250, 0, 0];
  const context = parsePreparedWorldContext({ ...base, system: { fadeOutStartDistanceM: 1e10, hiddenDistanceM: 1e11 },
    bodies: [parent, { ...satellite, positionM, orbit: { ...satellite.orbit, centerBodyId: parent.id,
      centerPositionM: parent.positionM, verticesM: [[250,0,0],[200,100,0],[100,150,0],[0,100,0],[-50,0,0],[0,-100,0],[100,-150,0],[200,-100,0]] } }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const child = layer.inspect().find(body => body.id === satellite.id)!;
  const marker = child.billboard as unknown as FakeElement, label = child.billboard as unknown as FakeElement;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  const camera = (z: number): WorldCameraPose => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [100, 0, z], orientationXyzw: [0, 0, 0, 1] } });
  layer.selectObject(parent.id);
  layer.publish(camera(1000), viewport);
  document.defaultView.advance(200);
  assert.equal(marker.style.visibility, ''); assert.equal(annotationVisibility(label, 'label'), '');
  assert.equal(declared(label, 'pointerEvents'), 'none');
  layer.publish(camera(180), viewport);
  assert.equal(marker.style.visibility, ''); assert.equal(annotationVisibility(label, 'label'), '');
  assert.equal(label.dataset.objectNavigateActivation, 'click'); assert.equal(declared(label, 'pointerEvents'), 'none');
  const [left, top] = captionPosition(label);
  const rect = child.labelRect!;
  // The caption's DOM position is written to a thousandth of a pixel (world-context-marker-paint.ts); its hit rect is exact.
  assert.ok(Math.abs(rect.left - (left)) < 10 ** -2 / 2, `${rect.left} is not close to ${left}`); assert.ok(Math.abs(rect.top - (top)) < 10 ** -2 / 2, `${rect.top} is not close to ${top}`);
  assert.equal((rect.right - rect.left), label.dataset.contextName.length * 6);
  assert.ok(layer.labelExclusionRects().some(item => isDeepStrictEqual(item, rect)));
  layer.publish(camera(1000), viewport);
  document.defaultView.advance(200);
  assert.equal(marker.style.visibility, ''); assert.equal(annotationVisibility(label, 'label'), '');
  layer.publish(camera(12000), viewport);
  document.defaultView.advance(200);
  assert.equal(annotationVisibility(label, 'label'), 'hidden');
  assert.equal(declared(label, 'pointerEvents'), 'none'); assert.equal(label.measurements, 1);
  layer.destroy(); assert.deepEqual(layer.labelExclusionRects(), []);
});

test('resolved body labels remain visible alongside faint close-up orbit lines', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), position = [35, 0, -60] as const;
  const context = parsePreparedWorldContext({ ...base, bodies: [{ ...base.bodies[0],
    positionM: position, radiusM: 8, orbit: orbit(position, 1) }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 40], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const body = layer.inspect().find(body => body.id === 'mercury')!;
  assert.equal(body.mover.style.visibility, '');
  assert.equal(body.orbit.some(paintedOrbitLeaf), true);
  assert.ok(Number(find(layer.root as unknown as FakeElement, 'contextOrbit', 'mercury').style.opacity) > 0);
  assert.equal(body.mover.style.visibility, '');
  assert.equal(body.billboard.dataset.objectNavigate, 'mercury');
  const [labelX, labelY] = captionPosition(body.billboard);
  assert.ok(Math.abs((labelX + 'Mercury'.length * 6 / 2) - (140)) < 10 ** -2 / 2, `${(labelX + 'Mercury'.length * 6 / 2)} is not close to ${140}`);
  assert.ok(labelY > 32);
  layer.destroy();
});

test('a moon label tries the other side when its first position overlaps the selected parent label', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1);
  const parent = { ...base.bodies[0], name: 'Jupiter', radiusM: 7, positionM: [400, 0, 0], orbit: orbit([400, 0, 0], 1) };
  // Below the parent on screen: the identity pose has +y up, so the moon sits at -y.
  const moon = { ...base.bodies[1], name: 'Ganymede', radiusM: .1, positionM: [326, -32, 0],
    orbit: { ...base.bodies[1].orbit, centerBodyId: parent.id, centerPositionM: parent.positionM,
      verticesM: [[326,-32,0], [400,-150,0], [550,0,0], [400,150,0], [250,0,0], [400,-150,0], [550,0,0], [400,150,0]] } };
  const context = parsePreparedWorldContext({ ...base, bodies: [parent, moon] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite} });
  layer.selectObject(parent.id);
  const camera: WorldCameraPose = { referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: {positionM: [400, 0, 400], orientationXyzw: [0, 0, 0, 1]} };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  for (let frame = 0; frame < 3; frame++) {
    layer.publish(camera, viewport); document.defaultView.advance(200);
    const label = layer.inspect().find(body => body.id === moon.id)!.billboard;
    assert.equal(annotationVisibility(label, 'label'), '');
    assert.ok(captionPosition(label)[0] < -74);
    const rects = layer.labelExclusionRects();
    assert.equal(rects.length, 2);
    assert.equal(labelRectsOverlap(rects[0], rects[1], 4), false);
  }
  layer.destroy();
});

for (const scale of [1, 1e9, 1e16]) test(`an orbit interior does not exclude background annotations at physical scale ${scale}`, () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(scale), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const camera: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000 * scale], orientationXyzw: [0, 0, 0, 1] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  layer.publish(camera, viewport);
  const backgroundText = { left: -10, top: 20, right: 10, bottom: 30 };
  assert.equal(layer.labelExclusionRects().every(rect => !labelRectsOverlap(backgroundText, rect)), true);
  assert.equal(layer.inspect().some(body => body.orbit.some(piece => piece.style.visibility === '')), true);
  assert.equal(layer.backgroundExclusionRects().some(rect => labelRectsOverlap(backgroundText, rect)), false);
  const circle = layer.inspect().find(body => body.id === 'mercury')!;
  assert.equal(circle.indicatorShown, true);
  const [x, y] = circle.center;
  assert.ok(layer.backgroundExclusionRects().some(item => isDeepStrictEqual(item, { left: x - 8, right: x + 8, top: y - 8, bottom: y + 8 })));
  assert.equal(layer.inspect().find(body => body.id === 'sun')!.mover.style.visibility, '');
  // Close orbits clip the viewport; they must not claim the entire background.
  layer.publish({ ...camera, pose: { ...camera.pose, positionM: [0, 0, 50 * scale] } }, viewport);
  assert.deepEqual(layer.backgroundExclusionRects(), layer.labelExclusionRects());
  layer.destroy();
});

for (const scale of [1, 1e9, 1e16]) test(`stars returning during a drag regain annotations at physical scale ${scale}`, () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(scale);
  const context = parsePreparedWorldContext({ ...base, bodies: base.bodies.map((body, index) => ({
    ...body, orbit: undefined, positionM: [(index ? -250 : 250) * scale, 120 * scale, 0],
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const camera: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000 * scale], orientationXyzw: [0, 0, 0, 1] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  const stars = () => layer.inspect().filter(body => body.id !== 'sun');
  layer.publish(camera, viewport);
  assert.equal(stars().every(body => body.labelShown && body.indicatorShown), true);
  layer.setRotationActive(true);
  layer.publish(camera, { ...viewport, principalOffsetPixels: [1000, 0] });
  assert.equal(stars().every(body => !body.labelShown && !body.indicatorShown), true);
  layer.publish(camera, viewport);
  assert.equal(stars().every(body => body.labelShown && body.indicatorShown), true);
  layer.setRotationActive(false);
  layer.publish(camera, viewport);
  assert.equal(stars().every(body => body.labelShown && body.indicatorShown), true);
  layer.destroy();
});

test('billboard zoom alpha owns dot, circle and caption without per-label clocks', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const body = layer.inspect().find(body => body.id === 'mercury')!, element = body.billboard as unknown as FakeElement;
  const nodes = all(root);
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(1000);
  assert.deepEqual(element.children.map(child => child.tagName), ['i', 'u']); assert.equal(element.textContent, '');
  assert.equal(element.dataset.contextName, 'Mercury');
  assert.equal(element.dataset.contextLabelVisible, 'true');
  assert.ok(Number((element.parentNode as unknown as HTMLElement).style.opacity) > 0);
  assert.equal(clock.timers.size, 0); assert.equal(layer.opacityStats().active, 0);
  publish(1e31);
  assert.equal(element.style.visibility, 'hidden');
  assert.equal(element.dataset.objectNavigate, undefined);
  publish(1000);
  assert.equal(element.style.visibility, '');
  assert.equal(element.dataset.objectNavigate, 'mercury');
  assert.equal(clock.timers.size, 0); expectRetained(root, nodes);
  layer.destroy();
});

test('a plain dot needs no sprite, paints its colour and is never a pick or navigation target', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: plan(1),
    sprites: { sun: sprite, venus: sprite }, plainDots: { ids: ['mercury'], minimumDiameterPixels: 2 } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1_000], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [30, -20] });
  const marker = layer.inspect().find(body => body.id === 'mercury')!.billboard, leaf = marker.children[0] as HTMLElement;
  assert.deepEqual(([leaf.style.backgroundImage ?? '', leaf.style.backgroundColor, declared(leaf, 'borderRadius')]), ['', '#9d9388', '50%']);
  assert.equal(marker.dataset.contextBodyVisible, 'true');
  assert.equal(marker.dataset.objectNavigate, undefined);
  assert.equal(screenPicking(host as unknown as HTMLElement).pick(70, -20), null);
  layer.destroy();
});

test('suppression retires the whole annotation while flight preserves admission and disables picking', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const element = layer.inspect().find(body => body.id === 'mercury')!.billboard;
  const opacity = (element.parentNode as unknown as HTMLElement).style.opacity;
  layer.setBodyVisibility({ labelSuppressed: ['mercury'] });
  assert.equal(annotationVisibility(element, 'label'), 'hidden');
  assert.equal(annotationVisibility(element, 'indicator'), 'hidden');
  assert.equal((element.parentNode as unknown as HTMLElement).style.opacity, opacity); assert.equal(clock.timers.size, 0);
  layer.setBodyVisibility({ labelSuppressed: [] });
  assert.equal(annotationVisibility(element, 'label'), '');
  layer.previewSelection('venus');
  layer.setNavigationInFlight(true);
  assert.equal(annotationVisibility(element, 'label'), '');
  assert.equal(annotationVisibility(element, 'indicator'), '');
  // The stage picker, cleared for the flight, owns every pointer hit. The
  // keyboard target is held rather than disabled and restored on every body.
  assert.equal(element.style.visibility, ''); assert.equal(element.dataset.objectNavigate, 'mercury');
  assert.equal(screenPicking(root.parentNode! as unknown as HTMLElement).pick(70, -20), null);
  layer.setNavigationInFlight(false);
  assert.equal(annotationVisibility(element, 'label'), '');
  assert.equal(annotationVisibility(element, 'indicator'), '');
  assert.equal(element.dataset.objectNavigate, 'mercury');
  assert.equal(screenPicking(root.parentNode! as unknown as HTMLElement).pick(70, -20), element);
  assert.equal(clock.timers.size, 0);
  layer.destroy();
});

test('the Sun locator stays visible across galactic observer rotations while resolved occluders still hide it', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), distance = 3.085677581491367e19;
  const context = parsePreparedWorldContext({ ...base,
    focus: { ...base.focus, radiusM: 6.957e8 }, frame: { ...base.frame, bodyRadiusM: 6.957e8 },
    // An orbiting occluder: an orbitless body would itself be a placed locator.
    bodies: [{ id: 'uranus', name: 'Uranus', positionM: [3e12, 0, 0], radiusM: 2.5e7, color: '#99bbcc', orbit: orbit([3e12, 0, 0], 1) }],
    system: { fadeOutStartDistanceM: 1e14, hiddenDistanceM: 1e15 } });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, uranus: sprite } });
  layer.selectObject('uranus');
  const focus = layer.inspect().find(body => body.id === 'sun')!, label = focus.billboard as unknown as FakeElement;
  const locator = focus.billboard as unknown as FakeElement;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  for (let degrees = 0; degrees < 360; degrees++) {
    const angle = degrees * Math.PI / 180;
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
      positionM: [distance * Math.sin(angle), 0, distance * Math.cos(angle)],
      orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
    } }, viewport);
    document.defaultView.advance(200);
    assert.equal(annotationVisibility(label, 'label'), '', `${degrees} degrees`); assert.ok(Math.abs(Number(label.parentNode!.style.opacity) - (1)) < 10 ** -2 / 2, `${Number(label.parentNode!.style.opacity)} is not close to ${1}`);
    assert.equal(annotationVisibility(locator, 'indicator'), '', `${degrees} degrees`); assert.ok(Math.abs(Number(locator.parentNode!.style.opacity) - (1)) < 10 ** -2 / 2, `${Number(locator.parentNode!.style.opacity)} is not close to ${1}`);
  }
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
    positionM: [3e12 + 1e8, 0, 0], orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  } }, viewport);
  assert.equal(declared(label, 'pointerEvents'), 'none');
  document.defaultView.advance(200);
  assert.equal(annotationVisibility(label, 'label'), 'hidden'); assert.equal(label.style.visibility, 'hidden');
  layer.destroy();
});

test('billboards straddle the selected detail in camera-depth order without replacing nodes', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = { ...source, bodies: source.bodies.map((body, index) => ({ ...body,
    positionM: (index === 0 ? [20, 0, 30] : [-20, 0, -30]) as [number, number, number] })) };
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  // The container must not trap foreground children behind the detailed body.
  assert.equal(declared(root, 'zIndex'), '');
  const depth = (id: string) => Number(mover(find(root, 'contextGroup', id)).style.zIndex);
  const publish = (z: number, orientationXyzw: [number, number, number, number]) => layer.publish({
    referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, z], orientationXyzw },
  }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(100, [0, 0, 0, 1]);
  assert.ok(depth('venus') < 0);
  // At this distance the selected Sun is detailed geometry, so its hidden
  // billboard does not need a z-index; the visible bodies still straddle it.
  assert.equal(find(root, 'contextGroup', 'sun').style.visibility, 'hidden');
  assert.ok(depth('mercury') > 3);
  publish(-100, [0, 1, 0, 0]);
  assert.ok(depth('mercury') < 0);
  assert.ok(depth('venus') > 3);
  layer.selectObject('venus');
  publish(-100, [0, 1, 0, 0]);
  assert.equal(depth('venus'), 0);
  assert.ok(depth('mercury') < depth('sun'));
  assert.ok(depth('sun') < 0);
  expectRetained(root, nodes);
  layer.destroy();
});

test('hover changes the orbit gap once per endpoint without measuring the ring', () => {
  const observer = mock.fn(() => {});
  stubGlobal('ResizeObserver', observer);
  const root = mount(1), layer = mounted.get(root)!;
  try {
    const body = layer.inspect().find(entry => entry.id === 'mercury')!;
    const indicator = body.billboard as unknown as FakeElement;
    const group = find(root, 'contextGroup', 'mercury');
    const nodes = all(root);
    const clock = root.ownerDocument.defaultView;
    const [cx, cy] = body.center;
    const gap = () => Math.min(...body.orbit.filter(line => line.style.visibility === '').flatMap(line => {
      const [dx, dy, , , x, y] = line.style.transform.slice(7, -1).split(',').map(Number);
      return [Math.hypot(x - cx, y - cy), Math.hypot(x + dx - cx, y + dy - cy)];
    }));
    const measurements = nodes.reduce((sum, element) => sum + element.measurements, 0);
    const hover = (active: boolean) => {
      group.dataset.objectHovered = String(active);
      root.parentNode!.dispatchEvent(new Event('objecthoverchange'));
      clock.advance(16);
    };
    const finishShrink = () => {
      const event = new Event('transitionend');
      Object.defineProperties(event, { propertyName: { value: 'transform' }, target: { value: indicator } });
      root.dispatchEvent(event); clock.advance(16);
    };
    assert.ok(Math.abs(gap() - (8)) < 10 ** -3 / 2, `${gap()} is not close to ${8}`);
    hover(true);
    assert.equal(indicator.dataset.contextIndicatorHovered, 'true');
    assert.ok(Math.abs(gap() - (10)) < 10 ** -3 / 2, `${gap()} is not close to ${10}`);
    const writes = body.orbit.map(node => (node as unknown as FakeElement).styleWrites);
    clock.advance(180);
    assert.deepEqual(body.orbit.map(node => (node as unknown as FakeElement).styleWrites), writes);
    hover(false);
    assert.equal(indicator.dataset.contextIndicatorHovered, 'false');
    assert.ok(Math.abs(gap() - (10)) < 10 ** -3 / 2, `${gap()} is not close to ${10}`); // Do not cut through a ring still shrinking.
    hover(true);
    finishShrink(); // A reversed transition cannot close the hover gap.
    assert.ok(Math.abs(gap() - (10)) < 10 ** -3 / 2, `${gap()} is not close to ${10}`);
    hover(false); finishShrink();
    assert.ok(Math.abs(gap() - (8)) < 10 ** -3 / 2, `${gap()} is not close to ${8}`);
    expectRetained(root, nodes);
    assert.equal(nodes.reduce((sum, element) => sum + element.measurements, 0), measurements);
    assert.equal(observer.mock.callCount(), 0);
  } finally {
    layer.destroy(); unstubAllGlobals();
  }
});

test('flights keep admitted annotations and orbit projection live with shared selection emphasis', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const mercury = layer.inspect().find(entry => entry.id === 'mercury')!;
  const sun = layer.inspect().find(entry => entry.id === 'sun')!;
  const nodes = all(root), orbit = mercury.orbit.map(node => ({ ...node.style }));
  const markerTransform = mover(mercury.billboard).style.transform;
  layer.setOverview(true);
  layer.previewSelection('mercury');
  layer.setNavigationInFlight(true);
  root.ownerDocument.defaultView.advance(200);
  const measurements = nodes.reduce((sum, node) => sum + node.measurements, 0);
  assert.equal(annotationVisibility(sun.billboard, 'label'), '');
  assert.equal(annotationVisibility(sun.billboard, 'indicator'), '');
  assert.ok(Number(mercury.mover.style.opacity) > 0);
  assert.notEqual(mercury.mover.style.opacity, '0');
  const orbitRoot = find(root, 'contextOrbit', 'mercury');
  assert.notEqual(orbitRoot.style.opacity, '0');
  // Keyboard targets hold through the flight; only the stage picker is cleared.
  assert.equal(orbitRoot.dataset.objectNavigate, 'mercury');
  assert.equal(screenPicking(root.parentNode! as unknown as HTMLElement).pick(70, -20), null);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [50, 0, 1_000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20], widthPixels: 800, heightPixels: 600 });
  assert.equal(nodes.reduce((sum, node) => sum + node.measurements, 0), measurements);
  assert.notEqual(mover(mercury.billboard).style.transform, markerTransform);
  assert.notDeepEqual(mercury.orbit.map(node => ({ ...node.style })), orbit);
  assert.ok(mover(mercury.billboard).style.transform.includes('50px'));
  assert.notEqual(orbitRoot.style.opacity, '0');
  layer.setNavigationInFlight(false);
  root.ownerDocument.defaultView.advance(200);
  assert.ok(Number(sun.mover.style.opacity) > 0);
  assert.notEqual(sun.mover.style.opacity, '0');
  assert.equal(orbitRoot.dataset.objectNavigate, 'mercury');
  expectRetained(root, nodes);
  layer.destroy();
});

test('one retained flight caption survives the sprite fade through arrival', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const nodes = all(root);
  layer.selectObject('mercury'); layer.previewSelection('mercury'); layer.setNavigationInFlight(true);
  let caption: FakeElement | undefined;
  const world = (diameter: number) => ({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, Math.hypot(1, 800 / diameter)], orientationXyzw: [0, 0, 0, 1] } } as const);
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] } as const;
  for (const diameter of [13, 17, 20, 100, 300]) {
    layer.publish(world(diameter), viewport);
    const current = find(root, 'contextFlightLabel', 'mercury');
    caption ??= current;
    assert.equal(current, caption);
    assert.equal(current.style.visibility, '');
    assert.equal(current.textContent, 'Mercury');
    assert.equal(current.style.zIndex, '4');
    assert.ok(Number(current.style.opacity) > 0);
    const marker = find(root, 'contextLabel', 'mercury');
    assert.equal(annotationVisibility(marker, 'label'), 'hidden');
    const circle = find(root, 'contextFlightCircle', 'mercury');
    assert.equal(circle.style.zIndex, '4');
    assert.equal(circle.style.visibility, diameter < 20 ? '' : 'hidden');
    if (diameter < 20) assert.ok(Number(circle.style.opacity) > 0);
    assert.equal(annotationVisibility(marker, 'indicator'), 'hidden');
    if (diameter >= 20) assert.equal(marker.parentNode!.style.opacity, '0');
  }
  layer.setNavigationInFlight(false); layer.publish(world(300), viewport);
  assert.equal(caption!.style.visibility, 'hidden');
  expectRetained(root, nodes);
  layer.destroy();
});

for (const destination of [null, 'venus']) test(`flights to ${destination} retain system annotations and orbit cutouts without enabling picking`, () => {
  const root = mount(1), layer = mounted.get(root)!;
  const nodes = all(root);
  layer.previewSelection(destination);
  const picking = screenPicking(root.parentNode! as unknown as HTMLElement);
  const before = layer.inspect().map(entry => ({ id: entry.id, label: entry.mover.style.opacity,
    indicator: entry.mover.style.opacity, orbit: entry.orbit.map(node => ({ ...node.style })),
    navigate: entry.billboard.dataset.objectNavigate }));
  assert.notEqual(picking.pick(30, -20), null);
  layer.setNavigationInFlight(true);
  for (const previous of before) {
    const entry = layer.inspect().find(entry => entry.id === previous.id)!;
    assert.equal(entry.mover.style.opacity, previous.label);
    assert.equal(entry.mover.style.opacity, previous.label);
    assert.deepEqual(entry.orbit.map(node => ({ ...node.style })), previous.orbit);
    // Keyboard state holds through the flight; the stage picker owns every hit
    // and is the one thing the flight clears, so nothing becomes pickable.
    assert.equal(entry.billboard.dataset.objectNavigate, previous.navigate);
  }
  assert.equal(picking.pick(30, -20), null);
  assert.equal(picking.pick(70, -20), null);
  layer.setOverview(true);
  layer.setNavigationInFlight(false);
  expectRetained(root, nodes);
  layer.destroy();
});

test('selection emphasis previews immediately and restores the selected detail when cleared', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const sun = find(root, 'contextGroup', 'sun'), mercury = find(root, 'contextGroup', 'mercury');
  layer.previewSelection('mercury');
  assert.equal(mercury.dataset.contextSelected, 'true');
  assert.equal(sun.dataset.contextSelected, 'false');
  layer.previewSelection(null);
  // Only the emphasized body is distinguished. With nobody emphasized both
  // markers publish the shared unselected value instead of a third state.
  assert.equal(mercury.dataset.contextSelected, 'false');
  assert.equal(sun.dataset.contextSelected, 'false');
  layer.previewSelection();
  assert.equal(sun.dataset.contextSelected, 'true');
  assert.equal(mercury.dataset.contextSelected, 'false');
  layer.destroy();
});

test('the Solar System overview has no body selection until the Sun is explicitly selected', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const nodes = all(root);
  const sun = find(root, 'contextGroup', 'sun');
  const mercury = find(root, 'contextGroup', 'mercury');
  const sprite = find(root, 'contextBody', 'mercury');
  // An overview emphasizes nobody, and styles distinguish only the emphasized
  // body, so every marker shares the same unselected value.
  const neutral = () => {
    assert.deepEqual([sun, mercury].map(body => body.dataset.contextSelected), ['false', 'false']);
  };

  layer.setOverview(true);
  root.ownerDocument.defaultView.advance(200);
  neutral();
  const normalOpacity = Number(sprite.parentNode!.style.opacity);
  assert.ok(normalOpacity > 0);

  // Selection changes immediately without dimming surrounding landmarks.
  layer.previewSelection('sun');
  root.ownerDocument.defaultView.advance(120);
  assert.equal(sun.dataset.contextSelected, 'true');
  assert.equal(mercury.dataset.contextSelected, 'false');
  assert.ok(Math.abs(Number(sprite.parentNode!.style.opacity) - (normalOpacity)) < 10 ** -2 / 2, `${Number(sprite.parentNode!.style.opacity)} is not close to ${normalOpacity}`);
  layer.setOverview(false);
  layer.previewSelection();
  assert.equal(sun.dataset.contextSelected, 'true');
  assert.ok(Math.abs(Number(sprite.parentNode!.style.opacity) - (normalOpacity)) < 10 ** -2 / 2, `${Number(sprite.parentNode!.style.opacity)} is not close to ${normalOpacity}`);

  // Returning to the overview keeps that same weight.
  layer.previewSelection(null);
  root.ownerDocument.defaultView.advance(120);
  neutral();
  assert.ok(Math.abs(Number(sprite.parentNode!.style.opacity) - (normalOpacity)) < 10 ** -2 / 2, `${Number(sprite.parentNode!.style.opacity)} is not close to ${normalOpacity}`);
  layer.setOverview(true);
  layer.previewSelection();
  neutral();
  assert.ok(Math.abs(Number(sprite.parentNode!.style.opacity) - (normalOpacity)) < 10 ** -2 / 2, `${Number(sprite.parentNode!.style.opacity)} is not close to ${normalOpacity}`);

  // A cancelled object selection restores the overview, not a Sun selection.
  layer.previewSelection('mercury');
  assert.equal(mercury.dataset.contextSelected, 'true');
  layer.previewSelection();
  neutral();
  assert.ok(Math.abs(Number(sprite.parentNode!.style.opacity) - (normalOpacity)) < 10 ** -2 / 2, `${Number(sprite.parentNode!.style.opacity)} is not close to ${normalOpacity}`);
  expectRetained(root, nodes);
  layer.destroy();
});

test('transports a non-rendered parent coordinate without creating a body or marker', () => {
  const source = structuredClone(plan(1));
  const center = { positionM: [50, 0, 0], centerBodyId: 'sun' };
  const bodies = source.bodies.map((body, index) => index === 0 ? { ...body,
    orbit: { ...body.orbit!, centerBodyId: 'patroclus', centerPositionM: center.positionM } } : body);
  const parsed = parsePreparedWorldContext({ ...source, bodies, orbitCenters: { patroclus: center } });
  assert.deepEqual(parsed.bodies.map(body => body.id), ['mercury', 'venus']);
  assert.deepEqual(parsed.orbitCenters?.patroclus, center);
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: parsed, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1_000], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  assert.equal(all(layer.root as unknown as FakeElement).some(node => Object.values(node.dataset).includes('patroclus')), false);
  layer.destroy();
});

test('rejects malformed, detached, duplicate or cyclic non-rendered orbit centres', () => {
  const source = structuredClone(plan(1));
  const center = { positionM: [50, 0, 0], centerBodyId: 'sun' };
  const bodies = source.bodies.map((body, index) => index === 0 ? { ...body,
    orbit: { ...body.orbit!, centerBodyId: 'patroclus', centerPositionM: center.positionM } } : body);
  const parse = (orbitCenters: unknown) => parsePreparedWorldContext({ ...source, bodies, orbitCenters });
  for (const orbitCenters of [
    {}, { patroclus: { ...center, positionM: [NaN, 0, 0] } },
    { patroclus: { ...center, positionM: [50, 0] } },
    { patroclus: { ...center, positionM: [51, 0, 0] } },
    { patroclus: center, sun: center }, { patroclus: center, mercury: center },
    { patroclus: { ...center, centerBodyId: 'missing' } },
    { patroclus: { ...center, centerBodyId: 'mercury' } },
    { patroclus: { ...center, centerBodyId: 'second' }, second: { ...center, centerBodyId: 'patroclus' } },
    { patroclus: { ...center, radiusM: 1 } },
  ]) assert.throws(() => parse(orbitCenters));
});

test('world presentation leaves the detail scope while retaining its input registry and focus updates', () => {
  const document = new FakeDocument(), host = document.createElement('main'), presentationHost = document.createElement('section');
  presentationHost.append(host);
  const request = mock.fn(() => true);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, presentationHost: presentationHost as unknown as HTMLElement,
    before: host as unknown as Element, plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite }, requestPublication: request });
  const world: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const, widthPixels: 800, heightPixels: 600 };
  layer.publish(world, viewport);
  assert.equal(host.children.length, 0);
  assert.equal((layer.root as unknown as FakeElement).parentNode, presentationHost);
  assert.notEqual(screenPicking(host as unknown as HTMLElement).pick(30, -20), null);
  assert.equal(screenPicking(presentationHost as unknown as HTMLElement).pick(30, -20), null);
  // Focus, like hover, changes annotations only: the plan in flight stays valid
  // and a publication is still requested so the change reaches the screen.
  request.mock.resetCalls(); // Initial eligible-caption measurement requests its own follow-up.
  const stale = layer.captureFrame(world, viewport);
  presentationHost.dispatchEvent(new Event('focusin'));
  document.defaultView.advance(16);
  assert.equal(stale.current(), true);
  assert.equal(request.mock.callCount(), 1);
  layer.destroy();
  presentationHost.dispatchEvent(new Event('focusin'));
  document.defaultView.advance(16);
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(presentationHost.children, [host]);
});

test('opacity-only ticks do not reproject, republish picking or measure retained annotations', () => {
  const request = mock.fn(() => true), root = mount(1, request), layer = mounted.get(root)!;
  const clock = root.ownerDocument.defaultView;
  request.mock.resetCalls(); // Measure eligible captions once at activation.
  const nodes = all(root), measurements = nodes.map(node => node.measurements);
  const transforms = nodes.map(node => node.style.transform);
  const picking = screenPicking(root.parentNode! as unknown as HTMLElement);
  const pick = mock.method(picking, 'publish');
  assert.equal(layer.opacityStats().active, 0); // Pseudo fades no longer schedule JS frames.
  clock.advance(100); clock.advance(100);
  assert.equal(request.mock.callCount(), 0); assert.equal(pick.mock.callCount(), 0);
  assert.deepEqual(nodes.map(node => node.measurements), measurements);
  assert.deepEqual(nodes.map(node => node.style.transform), transforms);
  expectRetained(root, nodes);
  assert.equal(layer.opacityStats().active, 0); assert.equal(clock.frames.size, 0);
  const writes = nodes.map(node => node.style.opacity);
  clock.advance(1000); assert.deepEqual(nodes.map(node => node.style.opacity), writes);
  layer.destroy();
});


test('the main thread draws worker frames from the orbit summary exactly as from the full context', () => {
  const full = plan(1);
  const summaryInput = { ...full, schema: 'cssearth-world-context-summary@2', bodies: full.bodies.map(({ orbit, ...body }) => !orbit ? body : { ...body,
    orbit: { centerBodyId: orbit.centerBodyId, centerPositionM: orbit.centerPositionM, vertexCount: orbit.verticesM.length, fullTrail: orbit.fullTrail,
      ...(orbit.bounds ? { bounds: orbit.bounds } : {}), ...(orbit.lod ? { lod: { bounds: orbit.lod.bounds } } : {}) } }) };
  const summary = parsePreparedWorldContextSummary(summaryInput);
  assert.throws(() => parsePreparedWorldContextSummary(structuredClone(full)), /Unsupported/);
  assert.throws(() => parsePreparedWorldContext(summaryInput), /Unsupported/);
  assert.throws(() => parsePreparedWorldContextSummary({ ...summaryInput, bodies: summaryInput.bodies.map(body =>
    'orbit' in body ? { ...body, orbit: { ...body.orbit, verticesM: [] } } : body) }), /verticesM/);
  const layers = [full, summary].map(prepared => {
    const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
    host.clientWidth = 800; host.clientHeight = 600; host.append(before);
    const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
      plan: prepared, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
    return { layer, root: layer.root as unknown as FakeElement };
  });
  const calculate = createWorldContextPlanner(full);
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const, widthPixels: 800, heightPixels: 600 };
  const drawing = (node: FakeElement) => all(node).map(node => ({ style: { ...node.style }, dataset: { ...node.dataset } }));
  for (const distance of [1000, 500, 50]) {
    world.pose.positionM[2] = distance;
    for (const { layer, root } of layers) {
      layer.publish(world, viewport, structuredClone(calculate(unpacked(layer.captureFrame(world, viewport).view))));
      // Attach the requested captions, measure them, then consume the measured worker frame.
      layer.publish(world, viewport, structuredClone(calculate(unpacked(layer.captureFrame(world, viewport).view))));
      layer.publish(world, viewport, structuredClone(calculate(unpacked(layer.captureFrame(world, viewport).view))));
      root.ownerDocument.defaultView.advance(50);
    }
    assert.equal(JSON.stringify(drawing(layers[1]!.root)), JSON.stringify(drawing(layers[0]!.root)));
  }
  // A flight or a selection preview with no worker publication to request (an interrupted flight's queue holds no current
  // request) waits for the next worker frame instead of planning paths the summary does not carry.
  assert.doesNotThrow(() => { layers[1]!.layer.setNavigationInFlight(true); layers[1]!.layer.previewSelection('venus'); });
  // Without a worker frame the layer would have to project paths the summary does not carry.
  assert.throws(() => layers[1]!.layer.publish({ ...world, pose: { ...world.pose, positionM: [0, 0, 700] } }, viewport), /full prepared world context/);
});

test('delta publication matches full frames through navigation, hover, fades and orbit retirement', () => {
  const root = mount(1, () => true), deltaRoot = mount(1, () => true);
  const full = mounted.get(root)!, incremental = mounted.get(deltaRoot)!;
  const calculate = createWorldContextPlanner(plan(1)), encode = createWorldContextFrameEncoder();
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const, widthPixels: 800, heightPixels: 600 };
  const drawing = (node: FakeElement) => all(node).map(node => ({ style: { ...node.style }, dataset: { ...node.dataset } }));
  let id = 0;
  const publish = () => {
    const a = full.captureFrame(world, viewport), b = incremental.captureFrame(world, viewport);
    const frame = structuredClone(calculate(unpacked(a.view)));
    full.publish(world, viewport, frame);
    incremental.publish(world, viewport, structuredClone(encode(++id, b.view.contextCommittedId ?? 0, frame)));
    root.ownerDocument.defaultView.advance(50); deltaRoot.ownerDocument.defaultView.advance(50);
    // Methods in the fake style object close over different owners.
    assert.equal(JSON.stringify(drawing(deltaRoot)), JSON.stringify(drawing(root)));
    assert.deepEqual(incremental.labelExclusionRects(), full.labelExclusionRects());
    assert.deepEqual(incremental.backgroundExclusionRects(), full.backgroundExclusionRects());
    for (let x = -400; x < 400; x += 40) for (let y = -300; y < 300; y += 40) {
      const pick = (node: FakeElement) => screenPicking(node.parentNode as unknown as HTMLElement).pick(x, y)?.dataset;
      assert.deepEqual(pick(deltaRoot), pick(root));
    }
  };
  for (const distance of [1000, 1000, 900, 500, 50, 500, 1000]) { world.pose.positionM[2] = distance; publish(); }
  for (const layer of [full, incremental]) { layer.setOverview(true); layer.setBodyVisibility({ orbitHidden: ['mercury'] }); }
  publish();
  for (const node of [root, deltaRoot]) {
    find(node, 'contextGroup', 'mercury').dataset.objectHovered = 'true';
    node.parentNode!.dispatchEvent(new Event('objecthoverchange'));
  }
  publish();
  for (const layer of [full, incremental]) { layer.setNavigationInFlight(true); layer.previewSelection('mercury'); }
  publish();
  for (const layer of [full, incremental]) { layer.selectObject('mercury'); layer.setNavigationInFlight(false); layer.setBodyVisibility({ orbitHidden: [] }); }
  publish();
  // A resize changes the absolute transform origin even when a body stays
  // at the same projected coordinates and the worker has no geometry delta.
  viewport.widthPixels = 1000; viewport.heightPixels = 700; publish();
  viewport.widthPixels = 800; viewport.heightPixels = 600; publish();
  for (let i = 0; i < 12; i++) publish();
  const writes = all(deltaRoot).reduce((sum, node) => sum + node.styleWrites, 0);
  const before = incremental.publicationStats();
  publish();
  assert.equal((all(deltaRoot).reduce((sum, node) => sum + node.styleWrites, 0) - writes), 0);
  assert.deepEqual(incremental.publicationStats(), { ...before, skippedPublications: before.skippedPublications + 1 });
  full.destroy(); incremental.destroy();
});

test('rotation and settlement use the same annotation rules without a deferred rearrangement', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const marker = find(root, 'contextBody', 'mercury');
  const camera = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  layer.publish(camera, viewport);
  layer.setRotationActive(true);
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  // An explicit policy change applies during motion, not in a burst on release.
  layer.setBodyVisibility({ labelSuppressed: ['mercury'] });
  assert.equal(marker.dataset.contextLabelVisible, 'false');
  for (const angle of [.05, .1, 0]) {
    camera.pose.orientationXyzw = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
    layer.publish(camera, viewport);
    assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
    assert.equal(marker.dataset.contextLabelVisible, 'false');
    assert.equal(layer.opacityStats().active, 0);
  }
  layer.setRotationActive(false);
  assert.equal(marker.dataset.contextLabelVisible, 'false');
  layer.setBodyVisibility({ labelSuppressed: [] });
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  assert.equal(marker.dataset.contextLabelVisible, 'true');
  layer.destroy();
});

test('hidden billboards settle without pseudo fades or depth writes and catch up before re-entry', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const marker = find(root, 'contextBody', 'mercury');
  const camera = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  layer.publish(camera, viewport);
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  layer.setOverview(true);
  layer.setBodyVisibility({ bodyHidden: ['sun', 'mercury', 'venus'] });
  root.ownerDocument.defaultView.advance(1000);
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  const counts = all(root).map(node => [node.styleWrites, node.attributeWrites]);
  const publications = layer.publicationStats();
  for (const angle of [.05, .1, -.1, 0]) {
    camera.pose.orientationXyzw = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
    layer.publish(camera, viewport);
  }
  assert.deepEqual(all(root).map(node => [node.styleWrites, node.attributeWrites]), counts);
  assert.deepEqual(layer.publicationStats(), publications);
  layer.selectObject('mercury');
  layer.setOverview(false);
  layer.setBodyVisibility({ bodyHidden: [] });
  assert.equal(marker.style.visibility, '');
  assert.equal(mover(marker).style.zIndex, '0');
  assert.equal(marker.dataset.contextSelected, 'true');
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  layer.publish(camera, viewport);
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  layer.destroy();
});

test('only interactive stationary hover arms transitions; every camera axis and flight cancels them', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const host = root.parentNode!, marker = find(root, 'contextBody', 'mercury');
  const camera = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as [number, number], widthPixels: 800, heightPixels: 600 };
  const hover = (value: boolean, interactive = true) => {
    marker.dataset.objectHovered = String(value);
    host.dispatchEvent(new CustomEvent('objecthoverchange', { detail: { interactive } }));
    clock.advance(16);
  };
  layer.publish(camera, viewport);
  hover(true, false);
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  hover(false, false);
  for (const move of [
    () => { camera.pose.positionM[2] += 50; },
    () => { camera.pose.positionM[0] += 5; },
    () => { camera.pose.orientationXyzw = [0, Math.sin(.01), 0, Math.cos(.01)]; },
    () => { viewport.focalPixels += 5; },
    () => { viewport.widthPixels += 5; },
    () => { viewport.principalOffsetPixels[0] += 5; },
    () => { layer.setNavigationInFlight(true); },
  ]) {
    hover(true);
    assert.equal(marker.dataset.contextAnnotationsAnimate, 'true');
    move(); layer.publish(camera, viewport);
    assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
    assert.equal(layer.opacityStats().active, 0);
    layer.setNavigationInFlight(false); hover(false, false);
  }
  hover(true);
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'true');
  // A press cancels in the input event, before a worker or animation frame can
  // publish the hover-out state captured by the preceding pointer movement.
  clock.dispatchEvent(new Event('pointerdown'));
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  assert.equal(layer.opacityStats().active, 0);
  hover(false, false); hover(true);
  layer.setBodyVisibility({ labelSuppressed: ['mercury'] });
  assert.equal(marker.dataset.contextLabelVisible, 'false');
  hover(false, false);
  assert.equal(marker.dataset.contextLabelVisible, 'false');
  assert.equal(marker.dataset.contextAnnotationsAnimate, 'false');
  layer.destroy();
});

test('switching selection leaves an unrelated visible billboard selection attribute untouched', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const sun = find(root, 'contextBody', 'sun');
  layer.previewSelection('mercury');
  assert.equal(sun.dataset.contextSelected, 'false');
  const writes = sun.attributeWrites;
  layer.previewSelection('venus');
  assert.equal(sun.dataset.contextSelected, 'false');
  assert.equal(sun.attributeWrites, writes);
  layer.destroy();
});

test('CSSOM transform serialization cannot turn an unchanged publication into another setter call', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const marker = find(root, 'contextBody', 'mercury'), orbit = find(root, 'contextOrbit', 'mercury');
  let writes = 0;
  for (const element of [mover(marker), orbit]) {
    let transform = element.style.transform;
    Object.defineProperty(element.style, 'transform', {
      get: () => transform.replace(/,\s*/g, ', '),
      set: (value: string) => { transform = value; writes++; },
    });
  }
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const, widthPixels: 800, heightPixels: 600 };
  for (let i = 0; i < 10; i++) layer.publish(world, viewport);
  assert.equal(writes, 0);
  // Positions are relative to the stage centre, so a wider stage moves nothing; a longer focal length moves the marker. The
  // orbit root stays anchored at the centre and is not rewritten.
  viewport.widthPixels = 900;
  layer.publish(world, viewport);
  assert.equal(writes, 0);
  viewport.focalPixels = 500;
  layer.publish(world, viewport);
  assert.equal(writes, 1);
  layer.publish(world, viewport);
  assert.equal(writes, 1);
  layer.destroy();
});

test('the orbit banks decode to the orbits of the full prepared file, each vertex within half an Int32 step', { timeout: 30_000 }, async () => {
  const prepared = new URL('../../src/objects/sun/prepared/', import.meta.url);
  const full = parsePreparedWorldContext(JSON.parse(await readFile(new URL('world-context.json', prepared), 'utf8')));
  // Every system's file read, as Node reads the world (site/world-context-plan.mts).
  const summary = await parseCompleteWorldContext(JSON.parse(await readFile(new URL('world-context-summary.json', prepared), 'utf8')),
    async id => JSON.parse(await readFile(new URL(`world-systems/${id}.json`, prepared), 'utf8')));
  const bankOf = async (id: string) => unpackPreparedBinary(await readFile(new URL(`world-orbits/${id}.bin`, prepared)), `world-orbits/${id}.bin`);
  const banks = new Map(await Promise.all(Object.keys(summary.orbitBanks!).map(async id => [id, await bankOf(id)] as const)));
  const decoded = decodeWorldOrbits(summary, banks);
  assert.deepEqual(decoded.bodies.map(body => body.id), full.bodies.map(body => body.id));
  for (const [index, body] of decoded.bodies.entries()) {
    const truth = full.bodies[index]!.orbit;
    if (!truth) { assert.equal(body.orbit, undefined, body.id); continue; }
    const { verticesM, bounds, lod, ...rest } = body.orbit!;
    const { verticesM: trueVertices, bounds: trueBounds, lod: trueLod, ...trueRest } = truth;
    assert.deepEqual(rest, trueRest, body.id);
    // The body's own vertex is the Int32 origin and decodes exactly; every other vertex lies within half a step on each axis,
    // plus the double rounding of adding the step count to a coordinate of order 1e11 m.
    const pinned = truth.closed === false ? truth.bodyVertexIndex! : 0;
    assert.deepEqual(([...verticesM.subarray(pinned * 3, pinned * 3 + 3)]), [...trueVertices.subarray(pinned * 3, pinned * 3 + 3)], body.id);
    let reach = 0;
    for (let i = 0; i < trueVertices.length; i++) reach = Math.max(reach, Math.abs(trueVertices[i]! - trueVertices[pinned * 3 + i % 3]!));
    for (let i = 0; i < trueVertices.length; i++) assert.ok(Math.abs(verticesM[i]! - trueVertices[i]!) <= reach / 0x7fffffff / 2 + 4 * Number.EPSILON * Math.abs(trueVertices[i]!), body.id);
    // Culling spheres are rounded outward: each still holds the sphere it rounds.
    for (const [rounded, exact] of [[bounds, trueBounds], [lod?.bounds, trueLod?.bounds]] as const) {
      if (!exact) continue;
      assert.ok(rounded!.radiusM >= exact.radiusM + Math.hypot(...rounded!.centerM.map((value, axis) => value - exact.centerM[axis]!)), body.id);
      assert.ok(rounded!.radiusM <= exact.radiusM * (1 + 3e-6), body.id);
    }
    assert.deepEqual(lod?.levels, trueLod?.levels, body.id);
  }
  // Each path is its own bank, named by its body. A bank of another size, one for a body the summary does not pin, or one
  // whose body carries another's path never decodes.
  assert.equal(banks.size, summary.bodies.filter(body => body.orbit).length);
  const earth = banks.get('earth')!;
  assert.deepEqual(([...decodeWorldOrbitBank(summary, 'earth', earth).keys()]), ['earth']);
  assert.throws(() => decodeWorldOrbitBank(summary, 'earth', earth.slice(0, earth.byteLength - 8)), /its summary says/);
  assert.throws(() => decodeWorldOrbitBank(summary, 'nowhere', earth), /summary says undefined/);
  assert.throws(() => decodeWorldOrbitBank({ ...summary, orbitBanks: { ...summary.orbitBanks, mars: earth.byteLength } }, 'mars', earth), /lacks its path/);
  // It parses the whole prepared world file (50 MB with exoplanet batch 1), which the default 5 s does not cover on CI.
});

test('circle dots grow with radius from 1,000 km to the system star, and stop there', () => {
  const dot = (radiusM: number) => indicatorDotDiameter(radiusM, 1e9, 2.4);
  assert.deepEqual(([dot(5e5), dot(1e6)]), [2.4, 2.4]);
  assert.ok(Math.abs(dot(Math.sqrt(1e6 * 1e9))! - ((2.4 + INDICATOR_DOT_MAX_DIAMETER) / 2)) < 10 ** -2 / 2, `${dot(Math.sqrt(1e6 * 1e9))} is not close to ${(2.4 + INDICATOR_DOT_MAX_DIAMETER) / 2}`);
  assert.deepEqual(([dot(1e9), dot(1e11)]), [INDICATOR_DOT_MAX_DIAMETER, INDICATOR_DOT_MAX_DIAMETER]);
  assert.equal(dot(0), null);
  // Real radii: Saturn reads clearly larger than Earth, and the Sun larger than Jupiter.
  const sun = (radiusM: number) => indicatorDotDiameter(radiusM, 695_700_000, 2.4)!;
  assert.ok((sun(58_232_000) - sun(6_371_000)) > 2);
  assert.ok((sun(695_700_000) - sun(69_911_000)) > 2);
});

test('a body circle holds a dot in the body colour until its own disc outgrows the dot', () => {
  // At this scale the plan's Mercury has a 1,000 km radius, the smallest dot, and its star a 10,000 km radius.
  const scale = 1e6, root = mount(scale), layer = mounted.get(root)!, marker = find(root, 'contextBody', 'mercury'), leaf = marker.children[0]!;
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100 * scale, 0, distance * scale], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  // Until its sprite first shows, a body sets no atlas image, so a page fetches only the atlas pages it draws.
  assert.ok(!leaf.style.backgroundImage.includes('url('));
  // Mercury's 0.8px disc sits inside its circle.
  publish(1000);
  assert.equal(marker.dataset.contextIndicatorVisible, 'true');
  assert.deepEqual(([leaf.style.backgroundImage, leaf.style.backgroundColor, leaf.style.borderRadius]), ['none', '#9d9388', '50%']);
  assert.equal(leaf.style.transform, `scale(${2.4 / 16})`);
  // Up close the circle retires and the prepared image returns at the disc's own size.
  publish(100);
  assert.equal(marker.dataset.contextIndicatorVisible, 'false');
  assert.deepEqual(([leaf.style.backgroundImage, leaf.style.backgroundColor, leaf.style.borderRadius]), ['url("/marker.png")', '', '']);
  layer.destroy();
});

test('inside the Solar System, moons without a circle stay inside their planet dot and other stars are dimmed', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(SCENE_OBJECTS.map(object => [object.id,
      labelImportance(object.classification, object.discovery.featured, object.discovery.orientationReference ?? 0)])),
    annotationLandmarks: ['io', 'europa', 'ganymede', 'callisto'],
  });
  layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [0, 0, 20 * 149_597_870_700], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1100, principalOffsetPixels: [0, 0], widthPixels: 1280, heightPixels: 720 });
  const jupiter = find(layer.root as unknown as FakeElement, 'contextBody', 'jupiter');
  assert.equal(jupiter.dataset.contextIndicatorVisible, 'true');
  assert.notEqual(jupiter.children[0]!.style.backgroundColor, '');
  for (const moon of ['io', 'europa', 'ganymede', 'callisto'])
    assert.equal(find(layer.root as unknown as FakeElement, 'contextBody', moon).dataset.contextBodyVisible, 'false');
  const opacity = (id: string) => Number(layer.inspect().find(body => body.id === id)!.mover.style.opacity);
  assert.ok(opacity('jupiter') > .9);
  assert.ok(opacity('proxima-centauri') > 0);
  assert.ok(opacity('proxima-centauri') <= .3);
  layer.destroy();
});

// The inertia gate (docs/performance/motion-freezes-membership.md): while the camera coasts, retained DOM changes only
// transform and opacity, plus the orbit strokes' paint exception. Production shape: strokes, and a coast reports rotation.
async function orbitEarth(options: { coast: boolean }) {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 820; host.clientHeight = 1094; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, orbitRenderer: 'strokes',
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(SCENE_OBJECTS.map(object => [object.id,
      labelImportance(object.classification, object.discovery.featured, object.discovery.orientationReference ?? 0)])) });
  const earth = context.bodies.find(body => body.id === 'earth')!;
  layer.selectObject('earth');
  // Orbit at 40 Earth radii: identity orientation looks down -Z, so rotating offset and orientation together about Y
  // keeps Earth centred while the Moon, Sun and planets sweep across the view.
  const publish = (angle: number) => layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt, pose: {
    positionM: [earth.positionM[0] + Math.sin(angle) * 40 * earth.radiusM, earth.positionM[1], earth.positionM[2] + Math.cos(angle) * 40 * earth.radiusM],
    orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)] } },
  { focalPixels: 900, principalOffsetPixels: [0, 0], widthPixels: 820, heightPixels: 1094 });
  publish(0);
  layer.setRotationActive(true);
  if (options.coast) layer.setCoasting(true);
  writeLog = [];
  // A quarter turn: the view it ends on differs from the one it began with.
  for (let frame = 1; frame <= 90; frame++) publish(frame * Math.PI / 2 / 90);
  const writes = writeLog; writeLog = null;
  return { layer, writes, publish, document };
}
const tally = (writes: readonly string[]) => Object.entries(writes.reduce<Record<string, number>>((all, write) => ({ ...all, [write]: (all[write] ?? 0) + 1 }), {}))
  .sort((a, b) => b[1] - a[1]).map(([write, count]) => `${count}x ${write}`);

test('a coast around Earth writes only transform and opacity, and the orbit strokes', async () => {
  const { layer, writes, publish } = await orbitEarth({ coast: true });
  const offPath = writes.filter(write => !/ style\.(transform|opacity|strokeOpacity)$| @points$/u.test(write));
  assert.deepEqual(tally(offPath), [], `${writes.length} writes over a 90-frame coast; off the fast path`);
  // The coast stops: the membership it held lands.
  writeLog = [];
  layer.setCoasting(false);
  layer.setRotationActive(false);
  publish(Math.PI / 2);
  const settled = writeLog; writeLog = null;
  assert.equal(settled.some(write => / style\.visibility$| data-contextLabelVisible$| data-contextIndicatorVisible$/u.test(write)), true, tally(settled).slice(0, 8).join(', '));
  layer.destroy();
});

test('names turn dark over the galaxy only from outside it, and a coast holds the change', () => {
  const root = mount(1), layer = mounted.get(root)!;
  assert.equal(root.dataset.galaxyView, undefined);
  layer.setOutsideGalaxy(true);
  assert.equal(root.dataset.galaxyView, 'outside');
  layer.setCoasting(true); layer.setOutsideGalaxy(false);
  assert.equal(root.dataset.galaxyView, 'outside');
  layer.setCoasting(false);
  assert.equal(root.dataset.galaxyView, undefined);
  layer.destroy();
});

test('a driven drag around Earth keeps revealing and retiring bodies', { timeout: 15000 }, async () => {
  const { layer, writes } = await orbitEarth({ coast: false });
  assert.ok(writes.filter(write => / style\.visibility$/u.test(write)).length > 0);
  layer.destroy();
}); // Full prepared catalogue, 90 driven views; CI runs this beside the other renderer suites.

 test('activation measures only captions the planner can name and caches those bounds', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const sun = find(root, 'contextLabel', 'sun'), mercury = find(root, 'contextLabel', 'mercury');
  const venus = find(root, 'contextLabel', 'venus');
  assert.equal(sun.measurements, 1);
  assert.equal(mercury.measurements, 1);
  assert.equal(venus.measurements, 0); // Occluded by the Sun; its text cannot contribute.
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  assert.equal(sun.measurements, 1); assert.equal(mercury.measurements, 1); assert.equal(venus.measurements, 0);
  layer.destroy();
});


test('world owners stay detached until requested, attach before measurement, and retain identity across views', () => {
  const document = new FakeDocument(), host = document.createElement('section');
  host.clientWidth = 800; host.clientHeight = 600;
  const before = document.createElement('div'); host.appendChild(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const owners = layer.inspect(), root = layer.root as unknown as FakeElement;
  assert.equal(owners.every(entry => entry.mover.parentNode === null), true);
  assert.equal(all(root).filter(node => node.dataset.contextBody !== undefined).length, 0);
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } } as const;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] } as const;
  layer.publish(world, viewport);
  const venus = owners.find(entry => entry.id === 'venus')!;
  assert.equal(venus.mover.parentNode, null);
  assert.equal((venus.billboard as unknown as FakeElement).measurements, 0);
  const attached = all(root);
  layer.setCoasting(true); layer.previewSelection('venus'); layer.publish(world, viewport);
  assert.deepEqual(all(root), attached);
  layer.setCoasting(false); layer.publish(world, viewport);
  assert.deepEqual(layer.inspect().map(entry => entry.mover), owners.map(entry => entry.mover));
  layer.destroy(); assert.equal(root.parentNode, null);
});
