import { readPreparedJson } from "./prepared-json-transport.mjs";
import { requireGeographicLensReference, requireGeographicLensPackage, geographicPackageIncludes } from "./geographic-lens-contract.mjs";
import { requireGeographicRoots } from "./prepared-map/geographic-index-contract.mjs";
import { createGeographicSurfaceRuntime } from "./geographic-surface-runtime.mjs";

// One active package and one preallocated renderer. Switching invalidates both
// in-flight transport and old pixels; adding a dataset adds no startup work.
export function createGeographicLensRuntime({ pages, capacity, surface, images, objectId, getEntity, selectBase, onChange = () => {}, fetcher = fetch }) {
  let revision = 0, request = null, destroyed = false;
  let selectedDescriptor = null, selectedEntityId = null;
  const overview = createGeographicSurfaceRuntime({ surface, fetcher, images });
  let state = { id: null, status: "idle", content: null, error: null };
  const publish = next => { state = next; if (!destroyed) onChange(state); };
  function clear() {
    revision++; request?.abort(); request = null;
    selectedDescriptor = null; selectedEntityId = null;
    overview.clear();
    pages.replacePlan(null);
    publish({ id: null, status: "idle", content: null, error: null });
  }
  const canRetain = entity => Boolean(state.content && entity && entity.id === selectedEntityId &&
    geographicPackageIncludes(state.content, objectId, entity.id) && entity.lenses?.some(lens =>
      lens.id === state.id && lens.package.sha256 === selectedDescriptor?.package.sha256));
  return Object.freeze({
    stats: overview.stats,
    canRetain,
    reconcileEntity() { if (state.id && !canRetain(getEntity())) clear(); },
    state: () => {
      if (!state.content) return state;
      const view = pages.stats();
      const errors = [...view.errors, ...(view.index?.errors ?? [])];
      const complete = view.desired.every(key => view.retained.some(slot => slot.key === key && slot.published));
      const empty = view.desired.length > 0 && complete && view.desired.every(key => view.retained.some(slot => slot.key === key && slot.empty));
      const status = errors.length ? "error" : view.pendingSelection || view.index?.activeLoads ? "loading" : empty ? "no-coverage" :
        !view.desired.length ? overview.stats().published ? "ready" : "no-coverage" : complete ? "ready" : "loading";
      return { ...state, status, resolution: view.desired.length ? "detail" : "overview", error: errors.at(-1) ?? null };
    },
    clear,
    async select(id) {
      const entity = getEntity(), descriptor = entity?.lenses?.find(lens => lens.id === id);
      if (destroyed || !descriptor) return false;
      const current = ++revision;
      request?.abort(); request = new AbortController();
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
      pages.replacePlan(null);
      overview.clear();
      selectedDescriptor = descriptor; selectedEntityId = entity.id;
      publish({ id, status: "loading", content: null, error: null });
      try {
        requireGeographicLensReference(descriptor, capacity.assetPath);
        const response = await fetcher(descriptor.package.url, { signal, credentials: "same-origin" });
        if (!response.ok) throw new Error(`Lens package: HTTP ${response.status}`);
        const content = requireGeographicLensPackage(await readPreparedJson(response, descriptor.package), descriptor, entity.id, capacity, objectId);
        let plan = content.pages;
        if (plan.rootDirectory) {
          const rootResponse = await fetcher(plan.rootDirectory.url, { signal, credentials: "same-origin" });
          if (!rootResponse.ok) throw new Error(`Geographic root directory: HTTP ${rootResponse.status}`);
          const roots = requireGeographicRoots(await readPreparedJson(rootResponse, plan.rootDirectory), plan);
          plan = { ...plan, roots };
        }
        if (destroyed || signal.aborted || current !== revision || getEntity() !== entity) return false;
        await pages.whenIdle?.();
        if (!await overview.prepare(content.overview, signal)) return false;
        if (destroyed || signal.aborted || current !== revision || getEntity() !== entity) return false;
        if (!await selectBase(content.baseLensId)) throw new Error("Lens base could not open.");
        if (destroyed || signal.aborted || current !== revision || getEntity() !== entity) return false;
        pages.replacePlan(plan);
        overview.publish();
        publish({ id, status: "ready", content, error: null });
        return true;
      } catch (error) {
        if (!destroyed && current === revision) {
          pages.replacePlan(null);
          overview.clear();
          publish({ id, status: "error", content: null, error: error.message });
        }
        return false;
      }
    },
    destroy() { if (destroyed) return; destroyed = true; clear(); overview.destroy(); },
  });
}
