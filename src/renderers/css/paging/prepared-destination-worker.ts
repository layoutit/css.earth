import type { DestinationWorkerRequest, DestinationWorkerResponse } from './destination-worker-types.js';
const workerGlobal = globalThis as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<DestinationWorkerRequest>) => void): void;
  postMessage(message: DestinationWorkerResponse): void;
};
import { createDestinationStore } from "./prepared-destination-store.js";

let store: ReturnType<typeof createDestinationStore> | null = null;
const jobs = new Map<number, AbortController>();
workerGlobal.addEventListener("message", async ({ data }) => {
  if (data.type === "init") {
    if (store) throw new Error("Destination worker is already bound.");
    store = createDestinationStore({ catalog: data.catalog });
    return;
  }
  if (data.type === "cancel") { jobs.get(data.id)?.abort(); return; }
  const controller = new AbortController();
  if (!store || jobs.size >= 8 || jobs.has(data.id)) {
    workerGlobal.postMessage({ id: data.id, error: "Destination worker request is incompatible." }); return;
  }
  jobs.set(data.id, controller);
  try {
    let value;
    if (data.type === "search") value = await store.search(data.query, data.limit, controller.signal);
    else if (data.type === "resolve") value = await store.resolve(data.entityId, controller.signal);
    else throw new Error("Unknown destination request.");
    if (!controller.signal.aborted) workerGlobal.postMessage({ id: data.id, value, stats: store.stats() });
  } catch (error) {
    if (!controller.signal.aborted) workerGlobal.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error), stats: store.stats() });
  } finally { jobs.delete(data.id); }
});
