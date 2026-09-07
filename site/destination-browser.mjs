import { createEntityRoute } from "./entity-route.mjs";
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
  let provider = null, matches = [], selection = null;
  let searchRequest = null, detailRequest = null;
  let query = "", revision = 0, destroyed = false, selecting = false;
  let selectionRevision = 0, route = null, unsubscribe = null;
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
    searchRequest?.abort(); searchRequest = new AbortController();
    clearRows();
    root.hidden = !value.trim();
    if (root.hidden) { onResults(0); return; }
    if (!provider) { hint.textContent = "Place search will be ready when the scene finishes loading."; onResults(1); return; }
    hint.textContent = "Loading places…";
    onResults(1);
    try {
      const results = await provider.search(value, buttons.length, AbortSignal.any([events.signal, searchRequest.signal]));
      if (destroyed || request !== revision) return;
      matches = results;
      for (const [index, button] of buttons.entries()) {
        const place = matches[index];
        button.parentElement.hidden = !place;
        if (!place) continue;
        button.querySelector(".planet-destination-result-name").textContent = place.name;
        button.querySelector(".planet-destination-result-context").textContent = place.context;
        button.dataset.destinationId = place.id;
        button.ariaLabel = `${place.name}, ${place.context}`;
      }
      hint.textContent = matches.length ? "Places" : "No matching places. Try another place name.";
      onResults(matches.length || 1);
    } catch (error) {
      if (destroyed || request !== revision) return;
      hint.textContent = "Places could not load. Change your search to retry.";
      onResults(1);
    }
  }

  async function select(place, options) {
    if (destroyed || !provider || !place) return;
    const request = ++selectionRevision;
    detailRequest?.abort(); detailRequest = new AbortController();
    selecting = true;
    for (const button of buttons) button.disabled = true;
    hint.textContent = `Opening ${place.name}…`;
    panel.ariaBusy = "true";
    try {
      const resolved = await provider.resolve(place.id, AbortSignal.any([events.signal, detailRequest.signal]));
      if (destroyed || request !== selectionRevision) return;
      if (!resolved) throw new Error("Unknown destination.");
      place = resolved.entity;
      const result = await provider.select(place, options);
      if (destroyed || request !== selectionRevision) return;
      selection = place;
      card.show(place, id => resolved.ancestors.find(entity => entity.id === id));
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
        // The new entity entry exists now, including with reduced motion.
        // Save its endpoint before exposing the completed flight to the UI.
        provider.saveView?.();
        panel.ariaBusy = "false";
        status.hidden = completed;
        status.textContent = completed ? "" : "Flight stopped. Select the place again to continue.";
      });
    } catch (error) {
      if (!destroyed && request === selectionRevision) { panel.ariaBusy = "false"; hint.textContent = "This place could not open. Select it to retry."; }
    } finally {
      if (request === selectionRevision) {
        selecting = false;
        if (!destroyed) for (const button of buttons) button.disabled = false;
      }
    }
  }
  buttons.forEach((button, index) => button.addEventListener("click", () => void select(matches[index]), { signal: events.signal }));
  async function selectRoot(options) {
    if (!provider) return;
    const request = ++selectionRevision;
    detailRequest?.abort();
    selecting = true;
    try {
      const result = await provider.reset(options);
      if (destroyed || request !== selectionRevision || result === false) return;
      selection = null;
      introductionRequest?.abort();
      panel.ariaBusy = "false"; status.hidden = true;
      card.show(card.initial); onReset(); route?.write();
      result.arrival?.then(() => {
        if (!destroyed && selection === null && request === selectionRevision) provider.saveView?.();
      });
    } catch { if (!destroyed) status.textContent = "Could not open the parent. Try again."; }
    finally { if (request === selectionRevision) { selecting = false; for (const button of buttons) button.disabled = false; } }
  }
  return Object.freeze({
    bind(next) {
      if (destroyed) return;
      revision++; selectionRevision++;
      searchRequest?.abort(); detailRequest?.abort(); introductionRequest?.abort();
      route?.destroy(); unsubscribe?.(); route = null; unsubscribe = null;
      provider = next; selection = null; selecting = false;
      panel.ariaBusy = "false"; status.hidden = true;
      for (const button of buttons) button.disabled = false;
      clearRows();
      if (!provider) { root.hidden = true; return; }
      route = createEntityRoute({ windowTarget: documentTarget.defaultView, rootId: card.initial.id,
        restoreView: provider.restoreView, writeUrl: provider.writeRoute, listenHistory: provider.listenHistory ?? true,
        read: () => ({ entityId: selection?.id ?? card.initial.id, lensId: provider.lens().id,
          defaultLens: card.initial.lensIds[0] }),
        async apply(id, lensId, live, options) {
          try {
            if (!live()) return;
            if (id === card.initial.id) { if (selection) await selectRoot(options); }
            else if (selection?.id !== id) {
              await select({ id, name: "place" }, options);
              if (selection?.id !== id) { status.hidden = false; status.textContent = "This place is unavailable in the current catalogue."; return; }
            }
            if (!live()) return;
            await provider.selectLens(lensId ?? card.initial.lensIds[0]);
          } catch {
            if (live()) { status.hidden = false; status.textContent = "This selection could not load. Refresh to retry."; }
          }
        },
      });
      unsubscribe = provider.subscribe(() => {
        if (!selecting && provider.state()?.id === selection?.id) { provider.saveView?.(); route.write(); }
      });
      if (query) void search(query);
      return route.restore();
    },
    search,
    restore() { return route?.restore(); },
    async selectById(id) { return id === card.initial.id ? selectRoot() : select({ id, name: "place" }); },
    destroy() { if (destroyed) return; destroyed = true; revision++; selectionRevision++; selection = null; route?.destroy(); unsubscribe?.(); events.abort(); clearRows(); },
  });
}
