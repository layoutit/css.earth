import { readPreparedJson } from "./prepared-json-transport.mjs";
import { requireGeographicLensReference, requireGeographicLensPackage, geographicPackageIncludes } from "./geographic-lens-contract.mjs";

// One active package and one preallocated renderer. Switching invalidates both
// in-flight transport and old pixels; adding a dataset adds no startup work.
export function createGeographicLensRuntime({ pages, capacity, objectId, getEntity, selectBase, onChange = () => {}, fetcher = fetch }) {
  let revision = 0, request = null, destroyed = false;
  let selectedDescriptor = null;
  let state = { id: null, status: "idle", content: null, error: null };
  const publish = next => { state = next; if (!destroyed) onChange(state); };
  function clear() {
    revision++; request?.abort(); request = null;
    selectedDescriptor = null;
    pages.replacePlan(null);
    publish({ id: null, status: "idle", content: null, error: null });
  }
  const canRetain = entity => Boolean(state.content && entity &&
    geographicPackageIncludes(state.content, objectId, entity.id) && entity.lenses?.some(lens =>
      lens.id === state.id && lens.package.sha256 === selectedDescriptor?.package.sha256));
  return Object.freeze({
    canRetain,
    reconcileEntity() { if (state.id && !canRetain(getEntity())) clear(); },
    state: () => {
      if (!state.content) return state;
      const view = pages.stats();
      const status = view.errors.length ? "error" : view.pendingSelection ? "loading" :
        !view.desired.length ? "no-coverage" : view.desired.every(key => view.retained.some(slot => slot.key === key && slot.published)) ? "ready" : "loading";
      return { ...state, status, error: view.errors.at(-1) ?? null };
    },
    clear,
    async select(id) {
      const entity = getEntity(), descriptor = entity?.lenses?.find(lens => lens.id === id);
      if (destroyed || !descriptor) return false;
      const current = ++revision;
      request?.abort(); request = new AbortController();
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
      pages.replacePlan(null);
      selectedDescriptor = descriptor;
      publish({ id, status: "loading", content: null, error: null });
      try {
        requireGeographicLensReference(descriptor, capacity.assetPath);
        const response = await fetcher(descriptor.package.url, { signal, credentials: "same-origin" });
        if (!response.ok) throw new Error(`Lens package: HTTP ${response.status}`);
        const content = requireGeographicLensPackage(await readPreparedJson(response, descriptor.package), descriptor, entity.id, capacity, objectId);
        if (destroyed || signal.aborted || current !== revision || getEntity() !== entity) return false;
        if (!await selectBase(content.baseLensId)) throw new Error("Lens base could not open.");
        if (destroyed || signal.aborted || current !== revision || getEntity() !== entity) return false;
        pages.replacePlan(content.pages);
        publish({ id, status: "ready", content, error: null });
        return true;
      } catch (error) {
        if (!destroyed && current === revision) {
          pages.replacePlan(null);
          publish({ id, status: "error", content: null, error: error.message });
        }
        return false;
      }
    },
    destroy() { if (destroyed) return; destroyed = true; clear(); },
  });
}
