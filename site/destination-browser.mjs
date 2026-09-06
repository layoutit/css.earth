import { createEntityRoute } from "./entity-route.mjs";
import { searchDestinations } from "./destination-search.mjs";
import { createEntityIntroductionSource } from "./entity-introduction.mjs";

export function createDestinationBrowser({ documentTarget, card, onSelected, onReset, onResults }) {
  const root = documentTarget.querySelector(".planet-destination-results");
  if (!root) return null;
  const list = root.querySelector(".planet-destination-list");
  const hint = root.querySelector(".planet-destination-hint");
  const panel = documentTarget.querySelector("[data-entity-card]");
  const status = panel.querySelector(".planet-destination-status");
  const buttons = [...list.querySelectorAll("button")];
  const events = new AbortController();
  let provider = null, catalog = null, pending = null, matches = [], selection = null;
  let query = "", revision = 0, destroyed = false, selecting = false;
  let selectionRevision = 0, route = null, unsubscribe = null;
  async function loadCatalog() {
    pending ??= provider.load(events.signal).catch(error => { pending = null; throw error; });
    return catalog ??= await pending;
  }
  const introductions = createEntityIntroductionSource();
  let introductionRequest = null;
  function loadIntroduction(place, request) {
    introductionRequest?.abort(); introductionRequest = new AbortController();
    card.introductionLoading();
    introductions.load(place.identifiers, AbortSignal.any([events.signal, introductionRequest.signal]))
      .catch(() => null).then(content => {
        if (!destroyed && selection === place && request === selectionRevision) card.showIntroduction(content);
      });
  }

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
    if (!provider) { hint.textContent = "Place search will be ready when the scene finishes loading."; onResults(1); return; }
    hint.textContent = "Loading places…";
    onResults(1);
    try {
      await loadCatalog();
      if (destroyed || request !== revision) return;
      matches = searchDestinations(catalog.places, value, buttons.length);
      for (const [index, button] of buttons.entries()) {
        const place = matches[index];
        button.parentElement.hidden = !place;
        if (!place) continue;
        button.querySelector(".planet-destination-result-name").textContent = place.name;
        button.querySelector(".planet-destination-result-context").textContent = place.context;
        button.dataset.destinationId = place.id;
        button.ariaLabel = `${place.name}, ${place.context}`;
      }
      hint.textContent = matches.length ? "Places · Countries and cities" : "No matching places. Try a country or city name.";
      onResults(matches.length || 1);
    } catch (error) {
      if (destroyed || request !== revision) return;
      hint.textContent = "Places could not load. Change your search to retry.";
      onResults(1);
    }
  }

  async function select(place) {
    if (destroyed || !provider || !place) return;
    const request = ++selectionRevision;
    selecting = true;
    for (const button of buttons) button.disabled = true;
    hint.textContent = `Opening ${place.name}…`;
    try {
      const result = await provider.select(place);
      if (destroyed || request !== selectionRevision) return;
      selection = place;
      card.show(place, id => catalog?.places.find(entity => entity.id === id));
      status.hidden = !result.arrival;
      status.textContent = result.arrival ? `Flying to ${place.name}…` : "";
      panel.ariaBusy = String(Boolean(result.arrival));
      panel.dataset.coverage = place.coverage;
      panel.hidden = false;
      onSelected(place);
      route?.write();
      loadIntroduction(place, request);
      result.arrival?.then(({ completed }) => {
        if (destroyed || selection !== place || request !== selectionRevision) return;
        panel.ariaBusy = "false";
        status.hidden = completed;
        status.textContent = completed ? "" : "Flight stopped. Select the place again to continue.";
      });
    } catch (error) {
      if (!destroyed && request === selectionRevision) hint.textContent = "This place could not open. Select it to retry.";
    } finally {
      if (request === selectionRevision) {
        selecting = false;
        if (!destroyed) for (const button of buttons) button.disabled = false;
      }
    }
  }
  buttons.forEach((button, index) => button.addEventListener("click", () => void select(matches[index]), { signal: events.signal }));
  async function selectRoot() {
    if (!provider) return;
    const request = ++selectionRevision;
    selecting = true;
    try {
      const result = await provider.reset();
      if (destroyed || request !== selectionRevision || result === false) return;
      selection = null;
      introductionRequest?.abort();
      panel.ariaBusy = "false"; status.hidden = true;
      card.show(card.initial); onReset(); route?.write();
    } catch { if (!destroyed) status.textContent = "Could not open the parent. Try again."; }
    finally { if (request === selectionRevision) { selecting = false; for (const button of buttons) button.disabled = false; } }
  }
  return Object.freeze({
    bind(next) {
      if (destroyed) return;
      provider = next;
      route?.destroy(); unsubscribe?.();
      route = createEntityRoute({ windowTarget: documentTarget.defaultView, rootId: card.initial.id,
        read: () => ({ entityId: selection?.id ?? card.initial.id, lensId: provider.lens().id,
          defaultLens: card.initial.lensIds[0] }),
        async apply(id, lensId, live) {
          try {
            if (id !== card.initial.id) await loadCatalog();
            if (!live()) return;
            const place = catalog?.places.find(entity => entity.id === id);
            if (id === card.initial.id) { if (selection) await selectRoot(); }
            else if (place) { if (selection?.id !== id) await select(place); }
            else {
              status.hidden = false; status.textContent = "This place is unavailable in the current catalogue."; return;
            }
            if (!live()) return;
            await provider.selectLens(lensId ?? card.initial.lensIds[0]);
          } catch {
            if (live()) { status.hidden = false; status.textContent = "This selection could not load. Refresh to retry."; }
          }
        },
      });
      unsubscribe = provider.subscribe(() => { if (!selecting && provider.state()?.id === selection?.id) route.write(); });
      if (query) void search(query);
      void route.restore();
    },
    search,
    async selectById(id) { if (id !== card.initial.id) await loadCatalog(); return id === card.initial.id ? selectRoot() : select(catalog?.places.find(entity => entity.id === id)); },
    destroy() { if (destroyed) return; destroyed = true; revision++; selectionRevision++; selection = null; route?.destroy(); unsubscribe?.(); events.abort(); clearRows(); },
  });
}
