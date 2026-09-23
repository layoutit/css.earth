import type { PreparedDestinationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { record, requiredElement } from './browser-types.mts';
import { FIND_PATH } from './find-protocol.mts';
export interface DestinationPlace extends Readonly<Record<string, unknown>> { name: string; context: string; coverage: string; }
function destinationPlace(input: unknown): DestinationPlace {
  if (!record(input) || !record(input.place) || !['name', 'context', 'coverage'].every(key => typeof (input.place as Record<string, unknown>)[key] === 'string')) throw new TypeError('Destination place requires its prepared record.');
  return input.place as DestinationPlace;
}
function destinationResult(input: unknown): { status: string; arrival?: Promise<{ completed: boolean }> } {
  if (!record(input) || typeof input.status !== 'string') throw new TypeError('Destination selection requires a status.');
  if (input.arrival === undefined || input.arrival === null) return { status: input.status };
  return { status: input.status, arrival: Promise.resolve(input.arrival).then(result => {
    if (!record(result) || typeof result.completed !== 'boolean') throw new TypeError('Destination arrival requires completion state.');
    return { completed: result.completed };
  }) };
}

/** The selected-city panel. Cities are found by the shared feature search; opening one asks the search function for that
 * one place's record, so no page downloads the body's places catalogue (Earth's is 14.8 MB). */
export function createDestinationBrowser({ documentTarget, onSelected, onReset }: { documentTarget: Document; onSelected(place: DestinationPlace): void; onReset(): void }) {
  const candidate = documentTarget.querySelector<HTMLElement>(".object-destination-panel");
  if (!candidate) return null;
  const panel = candidate;
  const heading = requiredElement(panel, ".object-destination-name");
  const context = requiredElement(panel, ".object-destination-context");
  const status = requiredElement(panel, ".object-destination-status");
  const back = requiredElement(panel, ".object-destination-back");
  const events = new AbortController();
  let provider: PreparedDestinationRuntime | null = null, bodyId: string | null = null, selection: DestinationPlace | null = null;
  let destroyed = false, selecting = false, selectionRevision = 0;

  async function select(place: DestinationPlace) {
    if (destroyed || !provider || selecting) return;
    const request = ++selectionRevision;
    selecting = true;
    try {
      const result = destinationResult(await provider.select(place));
      if (destroyed || request !== selectionRevision) return;
      selection = place;
      heading.textContent = place.name;
      context.textContent = place.context;
      status.textContent = result.arrival ? `Flying to ${place.name}…` : result.status;
      panel.ariaBusy = String(Boolean(result.arrival));
      panel.dataset.coverage = place.coverage;
      panel.hidden = false;
      onSelected(place);
      result.arrival?.then(({ completed }) => {
        if (destroyed || selection !== place || request !== selectionRevision) return;
        panel.ariaBusy = "false";
        status.textContent = completed ? result.status : "Flight stopped. Select the city again to continue.";
      }, () => {
        if (destroyed || selection !== place || request !== selectionRevision) return;
        panel.ariaBusy = "false";
        status.textContent = "Flight failed. Select the city again to retry.";
      });
    } finally {
      selecting = false;
    }
  }
  function clearSelection() {
    selectionRevision++;
    selection = null;
    panel.ariaBusy = "false";
    panel.hidden = true;
  }
  back.addEventListener("click", () => {
    provider?.reset();
    clearSelection();
    onReset();
  }, { signal: events.signal });
  /** Opens a place by its catalogue id: a search result, or a `?feature=city-<id>` link. */
  async function selectById(id: string) {
    if (destroyed || !provider || !bodyId || !/^[0-9]+$/u.test(id)) return;
    const requestedBody = bodyId, request = selectionRevision;
    const url = new URL(FIND_PATH, documentTarget.location?.href ?? 'http://localhost/');
    url.searchParams.set('object', requestedBody);
    url.searchParams.set('place', id);
    const response = await fetch(url, { signal: events.signal });
    if (!response.ok) throw new Error(`City ${id} could not load.`);
    const place = destinationPlace(await response.json());
    // The body may have changed while the place loaded; its city belongs to the body that asked.
    if (destroyed || bodyId !== requestedBody || request !== selectionRevision) return;
    await select(place);
  }
  return Object.freeze({
    /** Binds the mounted body's places; the Back label names that body, which differs from the page's first body after a flight. */
    bind(next: PreparedDestinationRuntime | null | undefined, body?: { id: string; name: string }) {
      if (destroyed) return;
      const nextBodyId = next && body ? body.id : null;
      // A selected city belongs to its body; another body starts without one.
      if (nextBodyId !== bodyId) clearSelection();
      provider = next ?? null;
      bodyId = nextBodyId;
      if (provider && body) back.textContent = `← Back to ${body.name}`;
    },
    selectById,
    setOpen(open: boolean) { if (destroyed) return; panel.hidden = open || !selection; },
    destroy() { if (destroyed) return; destroyed = true; selection = null; events.abort(); panel.hidden = true; },
  });
}
