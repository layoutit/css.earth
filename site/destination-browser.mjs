import { searchDestinations } from "./destination-search.mjs";

export function createDestinationBrowser({ documentTarget, onSelected, onReset, onResults }) {
  const root = documentTarget.querySelector(".planet-destination-results");
  if (!root) return null;
  const list = root.querySelector(".planet-destination-list");
  const hint = root.querySelector(".planet-destination-hint");
  const panel = documentTarget.querySelector(".planet-destination-panel");
  const heading = panel.querySelector(".planet-destination-name");
  const context = panel.querySelector(".planet-destination-context");
  const status = panel.querySelector(".planet-destination-status");
  const buttons = [...list.querySelectorAll("button")];
  const events = new AbortController();
  let provider = null, catalog = null, pending = null, matches = [], selection = null;
  let query = "", revision = 0, destroyed = false, selecting = false;
  let selectionRevision = 0;

  function clearRows() {
    matches = [];
    for (const button of buttons) button.parentElement.hidden = true;
  }

  async function search(value) {
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
      pending ??= provider.load(events.signal).catch(error => { pending = null; throw error; });
      catalog ??= await pending;
      if (destroyed || request !== revision) return;
      matches = searchDestinations(catalog.places, value, buttons.length);
      for (const [index, button] of buttons.entries()) {
        const place = matches[index];
        button.parentElement.hidden = !place;
        if (!place) continue;
        button.querySelector(".planet-destination-result-name").textContent = place.name;
        button.querySelector(".planet-destination-result-context").textContent = place.context;
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

  async function select(place) {
    if (destroyed || !provider || selecting || !place) return;
    const request = ++selectionRevision;
    selecting = true;
    for (const button of buttons) button.disabled = true;
    hint.textContent = `Opening ${place.name}…`;
    try {
      const result = await provider.select(place);
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
  panel.querySelector(".planet-destination-back").addEventListener("click", () => {
    provider?.reset();
    selectionRevision++;
    selection = null;
    panel.ariaBusy = "false";
    panel.hidden = true;
    onReset();
  }, { signal: events.signal });
  return Object.freeze({
    bind(next) { if (destroyed) return; provider = next; if (query) void search(query); },
    search,
    setOpen(open) { if (destroyed) return; panel.hidden = open || !selection; },
    destroy() { if (destroyed) return; destroyed = true; revision++; selection = null; events.abort(); clearRows(); panel.hidden = true; },
  });
}
