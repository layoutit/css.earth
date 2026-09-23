import { readFile } from 'node:fs/promises';
import type { OrbitPublication } from "../../renderers/css/navigation/object-orbit.ts";
import * as runtimePolicy from "../../../site/runtime-policy.mts";
import assert from "node:assert/strict";
import test from "node:test";
import { createObjectRuntime, parsePreparedObjectRuntime, preparedObjectCapabilities } from "../../renderers/css/dist/index.js";
import { createPreparedPlayback, createPreparedResidency, createObjectControlBinding, createObjectSelectionRuntime, mountPreparedPresentation, resolvePreparedPresentation } from "../../renderers/css/dist/testing.js";
import type { ObjectRuntimeDefinition } from "../../renderers/css/dist/index.js";
import type { ObjectControlBindingOptions, PreparedImage, PreparedPresentationContext } from "../../renderers/css/dist/testing.js";
import { viewSunDirectionToPreparedLightDirection } from "../directional-sun-coordinate.mts";
import { createSceneLifetime } from "@cssearth/engine";
import { requireObjectRuntimeDefinition } from "../../../tools/contract/object-runtime-contract.mts";
import { initialObjectSelection } from "../../renderers/css/dist/testing.js";
// Feature catalogues use the checked-in fixture bytes; these image-lifetime
// tests have no network service. Camera behavior has its own platform fixtures.
export const fixtureObjectCapabilities = { ...preparedObjectCapabilities,
  mountSurfaceFeatures(options: Parameters<NonNullable<typeof preparedObjectCapabilities.mountSurfaceFeatures>>[0]) {
    const mount = preparedObjectCapabilities.mountSurfaceFeatures;
    assert.ok(mount);
    return mount({ ...options, transport: async url => {
      if (!url.startsWith('/scenes/') || url.includes('..')) throw new Error('Invalid fixture catalogue URL');
      return new Response(new Uint8Array(await readFile(new URL(`../../../public${url}`, import.meta.url))));
    } });
  },
};
const flush = async (): Promise<void> => { for (let index = 0; index < 32; index++)
    await Promise.resolve(); };
// The fixture implements the DOM operations exercised by these tests. Native
// interfaces are adapted only where the real renderer accepts an element/document.
const html = (value: FixtureElement): HTMLElement => value as unknown as HTMLElement;
const nativeDocument = (value: FixtureDocument): Document => value as unknown as Document;
type FixtureDataset = Record<string, string | undefined>;
type FixtureStyle = CSSStyleDeclaration & Record<string, string>;
type FixtureListener = EventListenerOrEventListenerObject;
type FixtureAnimation = Pick<Animation, "play" | "pause" | "cancel" | "playbackRate" | "currentTime" | "playState"> & {
    readonly keyframes: Keyframe[] | PropertyIndexedKeyframes;
    readonly options: KeyframeAnimationOptions;
    readonly effect: {
        updateTiming(next: EffectTiming): void;
    };
};
class FixtureElement {
    nodeType: 1 | 11 = 1;
    readonly namespaceURI = "http://www.w3.org/1999/xhtml";
    readonly tagName: string;
    style: FixtureStyle;
    readonly dataset: FixtureDataset = {};
    readonly children: FixtureElement[] = [];
    parentNode: FixtureElement | null = null;
    readonly attributes = new Map<string, string>();
    readonly listeners = new Map<string, FixtureListener>();
    className = "";
    disabled = false;
    hidden = false;
    checked = false;
    name = "";
    value = "";
    ["aria-pressed"]?: string;
    type = "";
    min = "";
    max = "";
    step = "";
    private readonly document: FixtureDocument;
    constructor(document: FixtureDocument, tag = "div") { this.document = document; this.tagName = tag.toUpperCase(); this.style = createStyle(); }
    get ownerDocument(): Document { return nativeDocument(this.document); }
    get parentElement(): FixtureElement | null { return this.parentNode; }
    get isConnected(): boolean { return this === this.document.stage || this.parentNode?.isConnected === true; }
    get classList() { return { contains: (name: string) => this.className.split(/\s+/).includes(name), add: (...names: string[]) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" "); }, remove: (...names: string[]) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(" "); }, toggle: (name: string, enabled?: boolean) => { const next = enabled ?? !this.className.split(/\s+/).includes(name); if (next)
            this.classList.add(name);
        else
            this.classList.remove(name); return next; } }; }
    setAttribute(name: string, value: string): void { const text = String(value); this.attributes.set(name, text); if (name.startsWith("data-"))
        this.dataset[dataKey(name)] = text;
    else if (["disabled", "checked", "name", "value", "aria-pressed", "type", "min", "max", "step"].includes(name))
        Reflect.set(this, name, text); }
    getAttribute(name: string): string | null { return name.startsWith("data-") ? this.dataset[dataKey(name)] ?? null : this.attributes.get(name) ?? null; }
    hasAttribute(name: string): boolean { return this.getAttribute(name) !== null; }
    removeAttribute(name: string): void { this.attributes.delete(name); if (name.startsWith("data-"))
        delete this.dataset[dataKey(name)]; }
    contains(child: FixtureElement): boolean { return child === this || this.children.some(node => node.contains(child)); }
    closest(selector: string): FixtureElement | null { return this.className.split(/\s+/).includes(selector.slice(1)) ? this : this.parentNode?.closest(selector) ?? null; }
    appendChild(child: FixtureElement): FixtureElement { if (child.nodeType === 11) {
        for (const entry of [...child.children])
            this.appendChild(entry);
        return child;
    } child.remove(); this.children.push(child); child.parentNode = this; return child; }
    append(...children: FixtureElement[]): void { for (const child of children)
        this.appendChild(child); }
    prepend(...children: FixtureElement[]): void { for (const child of [...children].reverse()) { child.remove(); this.children.unshift(child); child.parentNode = this; } }
    insertBefore(child: FixtureElement, reference: FixtureElement | null): FixtureElement { if (reference === null) return this.appendChild(child); child.remove(); const index = this.children.indexOf(reference); if (index < 0) throw new Error("Reference node is not a child"); this.children.splice(index, 0, child); child.parentNode = this; return child; }
    removeChild(child: FixtureElement): FixtureElement { child.remove(); return child; }
    replaceChildren(...children: FixtureElement[]): void { for (const child of [...this.children])
        child.remove(); for (const child of children)
        this.appendChild(child); }
    remove(): void { if (this.parentNode)
        this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    querySelector(selector: string): FixtureElement | null {
        const directClass = /^:scope > \.([a-z-]+)$/u.exec(selector);
        if (directClass) return this.children.find(child => child.classList.contains(directClass[1])) ?? null;
        const attribute = /^\[([a-z-]+)\]$/u.exec(selector);
        if (attribute) return this.querySelectorAll().find(child => child.hasAttribute(attribute[1])) ?? null;
        throw new Error(`Unsupported fixture selector: ${selector}`);
    }
    querySelectorAll(_selector = "*"): FixtureElement[] { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); }
    addEventListener(name: string, callback: FixtureListener): void { this.listeners.set(name, callback); }
    removeEventListener(name: string, callback: FixtureListener): void { if (this.listeners.get(name) === callback)
        this.listeners.delete(name); }
    animate(keyframes: Keyframe[] | PropertyIndexedKeyframes, options: KeyframeAnimationOptions): Animation { const state: {
        playState: AnimationPlayState;
    } = { playState: "running" }; const animation: FixtureAnimation = { keyframes, options, effect: { updateTiming(next) { Object.assign(options, next); } }, currentTime: null, playbackRate: 1, get playState() { return state.playState; }, play() { state.playState = "running"; }, pause() { state.playState = "paused"; }, cancel() { state.playState = "idle"; } }; this.document.animations.push(animation); return animation as unknown as Animation; }
}
class FixtureDocument {
    readyState: DocumentReadyState = "complete";
    defaultView: Record<string, unknown> = { addEventListener() {}, removeEventListener() {}, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {} };
    head!: FixtureElement;
    readonly body = new FixtureElement(this, "body");
    stage: FixtureElement | null = null;
    readonly animations: FixtureAnimation[] = [];
    failAtElement: number | null = null;
    private count = 0;
    querySelector: (selector: string) => FixtureElement | null = () => null;
    // The runtime resolves form-linked settings inputs through the document; the fixture mounts none.
    querySelectorAll: (selector: string) => FixtureElement[] = () => [];
    createElement = (tag: string): FixtureElement => { if (++this.count === this.failAtElement)
        throw new Error("injected native element failure"); return new FixtureElement(this, tag); };
    createDocumentFragment = (): FixtureElement => { const fragment = new FixtureElement(this); fragment.nodeType = 11; return fragment; };
    getElementById(_id: string): FixtureElement | null { return null; }
}
function dataKey(name: string): string { return name.slice(5).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()); }
function createStyle(): FixtureStyle { const values: Record<string, string> = {}; const style = { getPropertyValue: (name: string) => values[name] ?? "", setProperty: (name: string, value: string) => { values[name] = value; }, removeProperty: (name: string) => { delete values[name]; } }; Object.defineProperty(style, "cssText", { set(value: string) { for (const entry of String(value).split(";")) {
        const colon = entry.indexOf(":");
        if (colon < 0)
            continue;
        const key = entry.slice(0, colon).trim(), next = entry.slice(colon + 1).trim();
        values[key] = next;
        (style as Record<string, unknown>)[key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())] = next;
    } } }); return new Proxy(style, { get(target, name) { return typeof name === "string" ? (target as Record<string, unknown>)[name] ?? "" : Reflect.get(target, name); } }) as unknown as FixtureStyle; }
function runtimeDefinition(value: unknown): ObjectRuntimeDefinition { const definition = parsePreparedObjectRuntime(value); requireObjectRuntimeDefinition(definition); return definition; }
class ControlledImage implements PreparedImage {
    naturalWidth = 1;
    naturalHeight = 1;
    src = "";
    decoding: "async" = "async";
    private settle!: {
        resolve(): void;
        reject(error: unknown): void;
    };
    private readonly promise = new Promise<void>((resolve, reject) => { this.settle = { resolve, reject }; });
    decode(): Promise<void> { return this.promise; }
    resolve(): void { this.settle.resolve(); }
    reject(error: unknown): void { this.settle.reject(error); }
    removeAttribute(name: string): void { if (name === "src")
        this.src = ""; }
}
type FixtureView = OrbitPublication & { reference?: FixtureView; revision: number; };
function objectView(definition: ObjectRuntimeDefinition, silhouetteDiameter?: number): FixtureView { const sun = definition.sun ?? null, direction = sun?.referenceViewDirection; const view: FixtureView = { controlPitch: definition.camera.defaultControlPitchDegrees ?? 0, controlYaw: definition.camera.defaultControlYawDegrees ?? 0, zoom: definition.camera.defaultZoom, revision: 1, sceneMatrix: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)", skyboxMatrix: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)", counterRotation: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)", counterRotationFor: () => "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)", skySunViewDirection: direction ?? null, sunViewDirection: direction ? viewSunDirectionToPreparedLightDirection(direction) : null, ...(silhouetteDiameter === undefined ? {} : { levelOfDetail: { stage: "geometry", silhouetteDiameter, billboardOpacity: 0, markerOpacity: 0, proxyOpacity: 0 } }) }; view.reference = view; return view; }
export function objectRuntimePackageTests(value: unknown): void {
    const definition = runtimeDefinition(value);
    test(`${definition.id}: the actual definition satisfies the common contract`, () => { resolvePreparedPresentation(definition, { selection: initialObjectSelection(definition.controls), view: objectView(definition) }); });
    // Startup decoding moved from the mount into the prepared resource lease (src/renderers/css/runtime/prepared-resource-lease.ts);
    // its cancellation, decode-failure and release-failure behaviour is covered by prepared-resource-lease.test.ts.
}
export function retainedPresentationFixture(value: unknown, { failAtElement = null }: {
    failAtElement?: number | null;
} = {}) {
    const definition = runtimeDefinition(value), previous = new Map(["document", "HTMLElement", "DOMMatrix"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    class Matrix {
        private readonly value: string;
        constructor(value = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)") { this.value = value; }
        translate(): this { return this; }
        rotate(): this { return this; }
        multiply(): this { return this; }
        toString(): string { return this.value; }
    }
    const document = new FixtureDocument();
    document.failAtElement = failAtElement;
    document.head = new FixtureElement(document, "head");
    const stage = new FixtureElement(document, "div");
    document.stage = stage;
    stage.className = "object-stage";
    Object.defineProperty(globalThis, "document", { configurable: true, value: nativeDocument(document) });
    Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: FixtureElement });
    Object.defineProperty(globalThis, "DOMMatrix", { configurable: true, value: Matrix });
    const lifetime = createSceneLifetime(), playback = createPreparedPlayback();
    lifetime.onDispose(() => playback.destroy());
    const resources = { has: (key: string) => definition.assets.entries.some(entry => entry.key === key), read: (_key: string) => null, readyKeys: () => definition.assets.entries.map(entry => entry.key), url: (key: string): string => { const entry = definition.assets.entries.find(candidate => candidate.key === key); assert.ok(entry, `Declared prepared resource ${key}`); return entry.url; } };
    const context: PreparedPresentationContext & {
        readonly resources: typeof resources;
        readonly density: number;
    } = { own: callback => lifetime.onDispose(callback), resources, density: 2, registerAnimation: playback.register, seekAnimation: playback.seek };
    return { stage: stage as FixtureElement & HTMLElement, lifetime, document, resources, playback, animations: document.animations, view: objectView(definition), context, restore() { lifetime.destroy(); for (const [name, descriptor] of previous) {
            if (descriptor)
                Object.defineProperty(globalThis, name, descriptor);
            else
                Reflect.deleteProperty(globalThis, name);
        } } };
}
interface SelectionJob {
    image: SelectionImage;
    url: string;
    resolve(): void;
    reject(error: unknown): void;
    done: boolean;
}
class SelectionImage implements PreparedImage {
    naturalWidth = 1;
    naturalHeight = 1;
    src = "";
    decoding: "async" = "async";
    private readonly definition: ObjectRuntimeDefinition;
    private readonly jobs: SelectionJob[];
    constructor(definition: ObjectRuntimeDefinition, jobs: SelectionJob[]) { this.definition = definition; this.jobs = jobs; }
    decode(): Promise<void> { this.naturalWidth = (this.definition.assets.entries.find(entry => entry.url === this.src)?.decodedBytes ?? 4) / 4; return new Promise((resolve, reject) => this.jobs.push({ image: this, url: this.src, resolve, reject, done: false })); }
    removeAttribute(name: string): void { if (name === "src")
        this.src = ""; }
}
export async function preparedSelectionFixture(value: unknown, { silhouetteDiameter }: {
    silhouetteDiameter?: number;
} = {}) {
    const definition = runtimeDefinition(value), f = retainedPresentationFixture(definition), jobs: SelectionJob[] = [], errors: unknown[] = [], materialErrors: unknown[] = [], timers = new Map<number, () => void>();
    let nextTimer = 0;
    const advanceTimers = (): void => { const pending = [...timers.values()]; timers.clear(); for (const callback of pending)
        callback(); };
    const schedule = ((callback: () => void): number => { timers.set(++nextTimer, callback); return nextTimer; }) as unknown as typeof setTimeout;
    const unschedule = ((id: number): void => { timers.delete(id); }) as unknown as typeof clearTimeout;
    const residency = createPreparedResidency({ assets: definition.assets, schedule, unschedule, createImage: () => new SelectionImage(definition, jobs) });
    f.lifetime.onDispose(() => residency.destroy());
    const startup = residency.prepareStartup();
    await settle();
    await startup;
    const presentationContext: PreparedPresentationContext & {
        resources: typeof residency.resources;
    } = { ...f.context, resources: residency.resources };
    const presentation = mountPreparedPresentation(html(f.stage), presentationContext, definition);
    residency.finishStartup();
    const inputs = new Map<string, FixtureElement>(), buttons: FixtureElement[] = [];
    const input = (fields: Partial<FixtureElement>): FixtureElement => Object.assign(new FixtureElement(f.document, fields.tagName ?? "input"), fields);
    for (const lens of definition.controls.lenses?.controls ?? [])
        buttons.push(input({ name: "dataset", value: lens.id, tagName: "BUTTON", type: "button" }));
    for (const control of definition.controls.settings?.controls ?? [])
        inputs.set(control.name, input({ name: control.name, type: control.kind === "toggle" ? "checkbox" : "range", min: "0", max: "4", step: "1" }));
    const lensRoot = f.document.createElement("div"), settingsRoot = f.document.createElement("div");
    const form = Object.assign(f.document.createElement("form"), { elements: buttons, closest: () => lensRoot });
    const details = new Map(buttons.map(button => {
        button.setAttribute('name', 'dataset'); button.setAttribute('value', button.value); button.setAttribute('aria-controls', button.value);
        return [button.value, f.document.createElement('div')];
    }));
    f.document.getElementById = id => details.get(id) ?? null;
    const information = Object.assign(f.document.createElement("section"), {
        querySelector: (selector: string): FixtureElement | null => selector === 'form[data-dataset-form]' ? form : null,
    });
    lensRoot.querySelectorAll = selector => selector === 'button[name="dataset"]' ? buttons : [];
    settingsRoot.querySelectorAll = selector => selector === 'input[name], button[name]' ? [...inputs.values()] : [];
    f.document.querySelector = selector => selector === ".object-information-panel" ? information
        : selector === ".object-settings" ? settingsRoot : null;
    let binding: ReturnType<typeof createObjectControlBinding> | null = null;
    const selection = createObjectSelectionRuntime({ definition, presentation, residency, lifetime: f.lifetime, onCommit: state => f.playback.setSelection(state), onChange: state => binding?.publish(state), onFatalError(error) { errors.push(error); f.lifetime.destroy(); }, onMaterialError: error => materialErrors.push(error) });
    f.lifetime.onDispose(() => selection.destroy());
    binding = createObjectControlBinding({ stage: html(f.stage), controls: definition.controls, initialSelection: initialObjectSelection(definition.controls), getState: selection.state, onAction: selection.dispatch, onError: error => materialErrors.push(error) } satisfies ObjectControlBindingOptions);
    f.lifetime.onDispose(() => binding?.destroy());
    const view = objectView(definition, silhouetteDiameter);
    selection.setView(view);
    async function settle(): Promise<void> { for (let wave = 0; wave < 30; wave++) {
        await flush();
        advanceTimers();
        await flush();
        const pending = jobs.filter(job => !job.done);
        if (!pending.length)
            return;
        for (const job of pending) {
            job.done = true;
            job.resolve();
        }
    } throw new Error("Prepared selection did not settle."); }
    const started = selection.start();
    await settle();
    assert.equal(await started, true);
    binding.setReady();
    f.playback.setReady();
    return { ...f, selection, binding, presentation, residency, view, inputs, buttons, jobs, errors, materialErrors, settle, flush, advanceTimers, listenerCount: (): number => [...inputs.values(), ...buttons].reduce((sum, element) => sum + element.listeners.size, 0) };
}
