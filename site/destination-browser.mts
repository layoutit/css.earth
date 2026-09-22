import { nextFrame } from "./next-frame.mts";
import type { PreparedDestinationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { record, requiredElement } from './browser-types.mts';
export interface DestinationPlace extends Readonly<Record<string, unknown>> { name: string; names: readonly string[]; context: string; searchContext: string; coverage: string; }
interface DestinationCatalog { places: readonly DestinationPlace[]; }
function destinationCatalog(input: unknown): DestinationCatalog {
  if (!record(input) || !Array.isArray(input.places)) throw new TypeError('Destination catalog requires places.');
  for (const place of input.places as unknown[]) {
    if (!record(place) || !['name', 'context', 'searchContext', 'coverage'].every(key => typeof place[key] === 'string') || !Array.isArray(place.names) || !place.names.every(name => typeof name === 'string')) throw new TypeError('Destination place requires prepared search labels.');
  }
  return input as unknown as DestinationCatalog;
}
function destinationResult(input: unknown): { status: string; arrival?: Promise<{ completed: boolean }> } {
  if (!record(input) || typeof input.status !== 'string') throw new TypeError('Destination selection requires a status.');
  if (input.arrival === undefined || input.arrival === null) return { status: input.status };
  return { status: input.status, arrival: Promise.resolve(input.arrival).then(result => {
    if (!record(result) || typeof result.completed !== 'boolean') throw new TypeError('Destination arrival requires completion state.');
    return { completed: result.completed };
  }) };
}
import { searchDestinations } from "./destination-search.mts";

export function createDestinationBrowser({ documentTarget, onSelected, onReset, onResults }: { documentTarget: Document; onSelected(place: DestinationPlace): void; onReset(): void; onResults(count: number): void }) {
  const candidate = documentTarget.querySelector<HTMLElement>(".planet-destination-results");
  if (!candidate) return null;
  const root = candidate;
  const list = requiredElement(root, ".planet-destination-list");
  const hint = requiredElement(root, ".planet-destination-hint");
  const panel = requiredElement(documentTarget, ".planet-destination-panel");
  const heading = requiredElement(panel, ".planet-destination-name");
  const context = requiredElement(panel, ".planet-destination-context");
  const status = requiredElement(panel, ".planet-destination-status");
  const buttons = [...list.querySelectorAll("button")];
  const events = new AbortController();
  let provider: PreparedDestinationRuntime | null = null, catalog: DestinationCatalog | null = null, pending: Promise<DestinationCatalog> | null = null, matches: DestinationPlace[] = [], selection: DestinationPlace | null = null;
  let query = "", revision = 0, destroyed = false, selecting = false;
  let selectionRevision = 0;

  function clearRows() {
    matches = [];
    for (const button of buttons) button.parentElement!.hidden = true;
  }

  async function search(value: string) {
    if (destroyed) return;
    query = value;
    const request = ++revision;
    clearRows();
    root.hidden = !value.trim();
    if (root.hidden) { onResults(0); return; }
    if (!provider) { hint.textContent = "City search will be ready when Earth finishes loading."; onResults(1); return; }
    hint.textContent = "Loading city names…";
    onResults(1);
    try {
      pending ??= provider.load(events.signal).then(destinationCatalog).catch(error => { pending = null; throw error; });
      catalog ??= await pending;
      // Typing faster than the page draws queues one search per keystroke; each scans every name. Wait for the next
      // frame, by which time every queued keystroke has arrived, and search only the newest text.
      await nextFrame(documentTarget);
      if (destroyed || request !== revision) return;
      matches = searchDestinations(catalog.places, value, buttons.length);
      for (const [index, button] of buttons.entries()) {
        const place = matches[index];
        button.parentElement!.hidden = !place;
        if (!place) continue;
        requiredElement(button, ".planet-destination-result-name").textContent = place.name;
        requiredElement(button, ".planet-destination-result-context").textContent = place.context;
        button.ariaLabel = `${place.name}, ${place.context}`;
      }
      hint.textContent = matches.length ? "Cities · GeoNames" : "No matching cities. Try a city name and country.";
      onResults(matches.length || 1);
    } catch (error) {
      if (destroyed || request !== revision) return;
      hint.textContent = "City names could not load. Change your search to retry.";
      onResults(1);
    }
  }

  async function select(place: DestinationPlace | undefined) {
    if (destroyed || !provider || selecting || !place) return;
    const request = ++selectionRevision;
    selecting = true;
    for (const button of buttons) button.disabled = true;
    hint.textContent = `Opening ${place.name}…`;
    try {
      const result = destinationResult(await provider.select(place));
      if (destroyed) return;
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
      });
    } catch (error) {
      if (!destroyed) hint.textContent = "This city could not open. Select it to retry.";
    } finally {
      selecting = false;
      if (!destroyed) for (const button of buttons) button.disabled = false;
    }
  }
  buttons.forEach((button, index) => button.addEventListener("click", () => void select(matches[index]), { signal: events.signal }));
  requiredElement(panel, ".planet-destination-back").addEventListener("click", () => {
    provider?.reset();
    selectionRevision++;
    selection = null;
    panel.ariaBusy = "false";
    panel.hidden = true;
    onReset();
  }, { signal: events.signal });
  return Object.freeze({
    bind(next: PreparedDestinationRuntime | null | undefined) { if (destroyed) return; provider = next ?? null; if (query) void search(query); },
    search,
    setOpen(open: boolean) { if (destroyed) return; panel.hidden = open || !selection; },
    destroy() { if (destroyed) return; destroyed = true; revision++; selection = null; events.abort(); clearRows(); panel.hidden = true; },
  });
}
