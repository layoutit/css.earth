import { publishDatasetPreview, sectionElements, showSection } from '@cssearth/renderer';
import type { FocusObject, PreparedFocusPresentation } from './prepared-focus.mts';
import { objectTypeLabel } from './object-classification-label.mts';
import { overviewHoldingAt } from './overview-context.mts';
import { wikipediaLearnMoreUrl } from './learn-more.mts';

interface PreparedFocusCard {
  set(object: FocusObject | null, presentation?: PreparedFocusPresentation | null): void;
  /** Adopt dataset banks spliced in after mount (`focus-fragment.mts`) and present the current object again. */
  adoptBanks(): void;
  destroy(): void;
}

/** One retained card presents the selected object from its registry entry; no catalogue is read here.
 * Its visibility belongs to the selection presentation (`selection-presentation.mts`). */
export function createPreparedFocusCard(root: HTMLElement | null, showTab: (id: string) => void = () => {}): PreparedFocusCard {
  if (!root) return { set() {}, adoptBanks() {}, destroy() {} };
  // The factsheet tab's panel waits in a template while closed (tab-panels.mts): its fields are found there too.
  const find = <E extends HTMLElement = HTMLElement>(selector: string) => sectionElements<E>(root, selector);
  const fields = Object.fromEntries(['name', 'aliases', 'introduction', 'status']
    .map(name => { const field = find(`[data-focus-${name}]`)[0]; if (!field) throw new Error(`Prepared focus field is missing: ${name}.`); return [name, field]; }));
  const aliasesRow = find('[data-focus-aliases-row]')[0] ?? null;
  const learnMore = find<HTMLAnchorElement>('[data-focus-learn-more]')[0] ?? null;
  const breadcrumbs = find('[data-focus-breadcrumb-scope]');
  const events = new AbortController();
  const unavailable = root.querySelector<HTMLElement>('[data-focus-unavailable]');
  const unavailableIds = new Set(unavailable?.dataset.unavailableObjects?.split(' ') ?? []);
  let currentPresentation: PreparedFocusPresentation | null = null;
  const datasetTab = root.querySelector<HTMLElement>('[data-information-tab="dataset"]');
  let currentRecordId: string | undefined;
  type Bank = { root: HTMLElement; buttons: HTMLButtonElement[]; details: HTMLElement[]; contexts: HTMLElement[] };
  const banks: Bank[] = [];
  const adopt = () => {
    for (const element of find('[data-focus-dataset-bank], [data-focus-facts-bank]')) {
      if (banks.some(bank => bank.root === element)) continue;
      const bank = { root: element,
        buttons: [...element.querySelectorAll<HTMLButtonElement>('[data-focus-dataset]')],
        details: sectionElements(element, '[data-focus-dataset-details]'),
        contexts: sectionElements(element, '[data-dataset-context]'),
      };
      for (const button of bank.buttons) button.addEventListener('click', event => {
        if (currentPresentation && currentPresentation.objectId === bank.root.dataset.focusDatasetBank) {
          event.preventDefault(); currentPresentation.selectDataset(button.getAttribute('value') ?? '');
        }
      }, { signal: events.signal });
      banks.push(bank);
    }
  };
  adopt();
  let presented: Parameters<PreparedFocusCard['set']> | null = null;
  const setPresentation = (record: FocusObject | null, presentation: PreparedFocusPresentation | null) => {
    const previous = currentPresentation?.objectId;
    currentPresentation = record && record.id === presentation?.objectId ? presentation : null;
    if (datasetTab && datasetTab.hidden !== !currentPresentation) datasetTab.hidden = !currentPresentation;
    if (record && (record.id !== currentRecordId || previous !== currentPresentation?.objectId))
      showTab(currentPresentation ? 'dataset' : 'factsheet');
    currentRecordId = record?.id;
    for (const bank of banks) {
      const active = currentPresentation?.objectId === (bank.root.dataset.focusDatasetBank ?? bank.root.dataset.focusFactsBank);
      // Only the selected object's bank is mounted; the others wait in templates (detached-sections.ts).
      showSection(bank.root, active);
      if (!active || !currentPresentation) continue;
      const available = new Set(currentPresentation.datasets.map(dataset => dataset.id));
      for (const button of bank.buttons) {
        // Read the prepared attribute in both the server DOM and the live browser.
        const dataset = button.getAttribute('value') ?? '';
        button.disabled = !available.has(dataset);
        const pressed = String(dataset === currentPresentation.selectedDataset);
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
      }
      publishDatasetPreview(bank.root, bank.buttons);
      for (const detail of bank.details) showSection(detail, detail.dataset.focusDatasetDetails === currentPresentation.selectedDataset);
      for (const context of bank.contexts) showSection(context, context.dataset.datasetContext === currentPresentation.selectedDataset);
    }
  };
  const write = (name: string, value: string) => { if (fields[name].textContent !== value) fields[name].textContent = value; };
  const card: PreparedFocusCard = { set(object, presentation = null) {
    presented = [object, presentation];
    setPresentation(object, presentation);
    if (unavailable) {
      const missing = object !== null && unavailableIds.has(object.id);
      if (unavailable.hidden !== !missing) unavailable.hidden = !missing;
      const message = missing ? `The 3D view of ${object.name} is unavailable in this installation. Its facts remain available.` : '';
      if (unavailable.textContent !== message) unavailable.textContent = message;
    }
    if (learnMore && !object) learnMore.hidden = true;
    if (!object) return;
    root.dataset.preparedFocusId = object.id;
    // Each object's facts are its package's own, rendered at build time (HostedObjectFacts.astro); only the selected one's is mounted.
    for (const bank of find('[data-focus-record-bank]')) showSection(bank, bank.dataset.focusRecordBank === object.id);
    const aliases = object.aliases.join(', ');
    write('name', object.name);
    write('aliases', aliases);
    write('introduction', object.description);
    if (fields.introduction.hidden) fields.introduction.hidden = false;
    // A nebula or a globular cluster keeps its classification out of the title; its facts state it.
    const galactic = object.classification === 'nebula' || object.classification === 'globular-cluster';
    if (fields.status.hidden !== galactic) fields.status.hidden = galactic;
    write('status', galactic ? '' : objectTypeLabel(object));
    if (learnMore) {
      const href = wikipediaLearnMoreUrl(object.name);
      if (learnMore.getAttribute('href') !== href) learnMore.setAttribute('href', href);
      learnMore.hidden = false;
    }
    if (aliasesRow) aliasesRow.hidden = !aliases;
    // The trail leads to the level that holds the object's classification (its overview's `holds`) where it lies.
    const parentScope = overviewHoldingAt(object.classification, object.worldFrame.originM)?.id;
    for (const trail of breadcrumbs) trail.hidden = trail.dataset.focusBreadcrumbScope !== parentScope;
  }, adoptBanks() { adopt(); if (presented) card.set(...presented); }, destroy() { events.abort(); currentPresentation = null; presented = null; } };
  return card;
}
