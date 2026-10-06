import { requiredElement, sectionElement } from '../browser/browser-types.mts';
import { showSection } from '@cssearth/renderer';

export interface DestinationPresentation {
  readonly name: string; readonly context: string; readonly coverage: string;
  readonly bodyName: string; readonly status: string; readonly flying: boolean;
}

/** Retained city panel. Navigation publishes its state; the panel never fetches or flies. */
export function createDestinationBrowser({ documentTarget, onSelected, onReset }: {
  documentTarget: Document; onSelected(): void; onReset(): void;
}) {
  // Mounted only while a city is selected; it waits off the page otherwise (detached-sections.ts).
  const panel = sectionElement(documentTarget, '.object-destination-panel');
  if (!panel) return null;
  const heading = requiredElement(panel, '.object-destination-name');
  const context = requiredElement(panel, '.object-destination-context');
  const status = requiredElement(panel, '.object-destination-status');
  const back = requiredElement(panel, '.object-destination-back');
  const events = new AbortController();
  back.addEventListener('click', onReset, { signal: events.signal });
  // The selected-content parent owns search visibility. This panel only owns
  // whether a city is selected, including the transition that closes search.
  const present = (value: DestinationPresentation | null) => {
    if (events.signal.aborted) return;
    const opening = value !== null && panel.hidden;
    const hidden = value === null, busy = String(value?.flying ?? false);
    if (panel.hidden !== hidden || panel.isConnected === hidden) showSection(panel, !hidden);
    if (panel.ariaBusy !== busy) panel.ariaBusy = busy;
    if (value) {
      heading.textContent = value.name;
      context.textContent = value.context;
      status.textContent = value.status;
      panel.dataset.coverage = value.coverage;
      back.textContent = `← Back to ${value.bodyName}`;
      if (opening) onSelected();
    }
  };
  return Object.freeze({
    present,
    destroy() { present(null); events.abort(); },
  });
}
