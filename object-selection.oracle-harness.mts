import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
// Oracle: the selection runtime under test is injected.
let createObjectSelectionRuntime: typeof import('../renderers/css/dist/testing.js').createObjectSelectionRuntime;
export function useSelectionRuntime(factory: typeof createObjectSelectionRuntime) { createObjectSelectionRuntime = factory; }
import { createPreparedResidency } from '../renderers/css/dist/testing.js';
import { retainedPresentationFixture, preparedSelectionFixture } from "./test/object-runtime-package.mts";
import { mountPreparedPresentation } from '../renderers/css/dist/testing.js';
import { parsePreparedObjectRuntime } from '../renderers/css/dist/index.js';
import type { ObjectSelection } from '../renderers/css/runtime/object-contract.ts';
import type { ObjectRuntimeDefinition } from '../renderers/css/runtime/object-runtime-types.ts';
import type { ObjectSelectionState } from '../renderers/css/rendering/object-selection-runtime.ts';
import type { PreparedImage } from '../renderers/css/rendering/prepared-image-store.ts';
import type { PreparedResidencyTicket } from '../renderers/css/rendering/prepared-residency.ts';
import type { PreparedPresentationContext, PreparedPresentationPlan, PreparedView } from '../renderers/css/rendering/prepared-presentation.ts';
const earthDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('earth'));
const saturnDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('saturn'));
import { requireObjectRuntimeDefinition } from "../../tools/contract/object-runtime-contract.mts";
import { viewSunDirectionToPreparedLightDirection } from "./directional-sun-coordinate.mts";

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
// The actual Earth plan provides independent lighting and atmosphere row demand.
// Only native image completion and DOM setters are controlled by these tests.
interface ImageJob { url: string; image: ControlledImage; resolve(): void; reject(error: unknown): void; done: boolean; }
class ControlledImage implements PreparedImage {
  naturalWidth = 1; naturalHeight = 1; src = ""; decoding: "async" = "async";
  private readonly definition: ObjectRuntimeDefinition;
  private readonly jobs: ImageJob[];
  constructor(definition: ObjectRuntimeDefinition, jobs: ImageJob[]) { this.definition = definition; this.jobs = jobs; }
  decode(): Promise<void> {
    this.naturalWidth = (this.definition.assets.entries.find(entry => entry.url === this.src)?.decodedBytes ?? 4) / 4;
    return new Promise<void>((resolve, reject) => this.jobs.push({ url: this.src, image: this, resolve, reject, done: false }));
  }
  removeAttribute(name: string): void { if (name === "src") this.src = ""; }
}
interface HarnessOptions {
  initialLens?: string;
  onTicket?: (ticket: PreparedResidencyTicket) => void;
  onChange?: (state: Readonly<ObjectSelectionState>) => void;
  deferTextureRefinement?: boolean;
}
function harness({ onTicket, onChange, deferTextureRefinement, initialLens }: HarnessOptions = {}) {
  const definition = earthDefinition, f = retainedPresentationFixture(definition);
  const jobs: ImageJob[] = [], commits: { selection: ObjectSelection; plan: PreparedPresentationPlan }[] = [], changes: Readonly<ObjectSelectionState>[] = [], fatal: unknown[] = [], materialErrors: unknown[] = [], created: ReturnType<typeof f.document.createElement>[] = [];
  const createElement = f.document.createElement;
  f.document.createElement = tag => { const node = createElement(tag); created.push(node); return node; };
  const timers = new Map(); let nextTimer = 0;
  const schedule = ((callback: () => void): number => { timers.set(++nextTimer, callback); return nextTimer; }) as unknown as typeof setTimeout;
  const unschedule = ((id: number): void => { timers.delete(id); }) as unknown as typeof clearTimeout;
  const resources = createPreparedResidency({ assets: definition.assets, schedule, unschedule,
    createImage: () => new ControlledImage(definition, jobs) });
  f.lifetime.onDispose(() => resources.destroy());
  const residency = { ...resources, request(plan: Parameters<typeof resources.request>[0], options?: Parameters<typeof resources.request>[1]) {
    const ticket = resources.request(plan, options); onTicket?.(ticket); return ticket;
  } };
  const presentationContext: PreparedPresentationContext & { resources: typeof resources.resources } = { ...f.context, resources: resources.resources };
  const presentation = mountPreparedPresentation(f.stage, presentationContext, definition);
  const coordinator = createObjectSelectionRuntime({ definition, presentation, residency, lifetime: f.lifetime,
    deferTextureRefinement, initialLens,
    onChange: state => { changes.push(state); onChange?.(state); }, onCommit: (selection, plan, intent) => commits.push({ selection, plan, intent } as never),
    onFatalError(error) { fatal.push(error); f.lifetime.destroy(); }, onMaterialError: error => materialErrors.push(error) });
  f.lifetime.onDispose(() => coordinator.destroy());
  let revision = 0, currentView: PreparedView | undefined;
  function view(row: number, withinRow = 0): PreparedView {
    const track = definition.materials[1], frame = 20 + row * 32 + withinRow;
    const z = frame / (track.frame.indices.length - 1) * 2 - 1;
    const direction: readonly [number, number, number] = [Math.sqrt(1 - z * z), 0, z];
    const next: PreparedView = { ...f.view, controlPitch: 37, controlYaw: 10, zoom: definition.camera.defaultZoom,
      levelOfDetail: { stage: 'geometry', silhouetteDiameter: 100, billboardOpacity: 0, markerOpacity: 0 },
      revision: ++revision, sceneMatrix: matrix, counterRotation: matrix, counterRotationFor: () => matrix,
      sunViewDirection: direction, reference: currentView?.reference, };
    next.reference = currentView?.reference ?? next; currentView = next; coordinator.setView(next); return next;
  }
  view(0); const initialReady = coordinator.start();
  async function resolveJobs({ exclude = [] }: { exclude?: readonly ImageJob[] } = {}) {
    for (let wave = 0; wave < 45; wave++) {
      await flush(); const queued = [...timers.values()]; timers.clear(); for (const callback of queued) callback(); await flush();
      const pending = jobs.filter(job => !job.done && !exclude.includes(job));
      if (!pending.length) return;
      pending.forEach(job => { job.done = true; job.resolve(); });
    }
    throw new Error("Real prepared resource queue did not settle.");
  }
  async function ready() { await resolveJobs(); assert.equal(await initialReady, true); }
  return { ...f, resources, coordinator, presentation, created, jobs, commits, changes, fatal, materialErrors,
    view, currentView: (): PreparedView => { assert.ok(currentView); return currentView; }, initialReady, ready, resolveJobs,
    lens: (id: string) => coordinator.dispatch({ kind: "lens", id }),
    frameCount: () => presentation.observe().presentation.framePublications,
    atmosphereTarget: () => created[definition.materials[1].target],
  };
}

export { harness, earthDefinition, flush };
