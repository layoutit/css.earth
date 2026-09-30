import { catalogueClassification, isPreparedCluster, isPreparedNebula } from '@cssearth/catalog';
import { publishDatasetPreview, sectionElements, showSection } from '@cssearth/renderer';
import type { PreparedCatalogObject, SpatialCitation } from '@cssearth/catalog';
import { preparedFocusObjectId } from './prepared-focus.mts';
import type { PreparedFocusPresentation } from './prepared-focus.mts';
import { overviewHolding } from '@cssearth/objects';
import { KNOWN_OVERVIEWS } from './object-directory.mts';
import { wikipediaLearnMoreUrl } from './learn-more.mts';

interface PreparedFocusCard {
  set(record: PreparedCatalogObject | null, sources?: readonly SpatialCitation[], presentation?: PreparedFocusPresentation | null): void;
  /** Adopt dataset banks spliced in after mount (`focus-fragment.mts`) and present the current record again. */
  adoptBanks(): void;
  destroy(): void;
}

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });
const words = (value: string) => value.replaceAll('-', ' ').replace(/^./u, letter => letter.toUpperCase());

/** One retained card transports the selected prepared record; no catalogue is imported here.
 * Its visibility belongs to the selection presentation (`selection-presentation.mts`). */
export function createPreparedFocusCard(root: HTMLElement | null, showTab: (id: string) => void = () => {}): PreparedFocusCard {
  if (!root) return { set() {}, adoptBanks() {}, destroy() {} };
  // The factsheet tab's panel waits in a template while closed (tab-panels.mts): its fields are found there too.
  const find = <E extends HTMLElement = HTMLElement>(selector: string) => sectionElements<E>(root, selector);
  const fields = Object.fromEntries(['name', 'aliases', 'introduction', 'status', 'distance', 'uncertainty', 'membership', 'association']
    .map(name => { const field = find(`[data-focus-${name}]`)[0]; if (!field) throw new Error(`Prepared focus field is missing: ${name}.`); return [name, field]; }));
  const aliasesRow = find('[data-focus-aliases-row]')[0] ?? null;
  const learnMore = find<HTMLAnchorElement>('[data-focus-learn-more]')[0] ?? null;
  const links = find<HTMLAnchorElement>('[data-focus-source]');
  const sourceRows = find('[data-focus-source-row]');
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
  const setPresentation = (record: PreparedCatalogObject | null, presentation: PreparedFocusPresentation | null) => {
    const previous = currentPresentation?.objectId;
    currentPresentation = record && preparedFocusObjectId(record) === presentation?.objectId ? presentation : null;
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
  const card: PreparedFocusCard = { set(record, sources = [], presentation = null) {
    presented = [record, sources, presentation];
    setPresentation(record, presentation);
    if (unavailable) {
      const objectId = record && preparedFocusObjectId(record);
      const missing = objectId && unavailableIds.has(objectId);
      if (unavailable.hidden !== !missing) unavailable.hidden = !missing;
      const message = missing ? `The 3D view of ${record.name} is unavailable in this installation. Catalogue facts remain available.` : '';
      if (unavailable.textContent !== message) unavailable.textContent = message;
    }
    if (learnMore && !record) learnMore.hidden = true;
    if (!record) return;
    root.dataset.preparedFocusId = record.id;
    for (const bank of find('[data-focus-record-bank]')) showSection(bank, bank.dataset.focusRecordBank === record.id);
    const cluster = isPreparedCluster(record), nebula = isPreparedNebula(record);
    const aliases = record.aliases.join(', ');
    write('name', record.name);
    write('aliases', aliases);
    write('introduction', nebula ? record.introduction.text : aliases ? `Also known as ${aliases}` : '');
    fields.introduction.hidden = !nebula && !aliases;
    if (learnMore) {
      const href = wikipediaLearnMoreUrl(record.name);
      if (learnMore.getAttribute('href') !== href) learnMore.setAttribute('href', href);
      learnMore.hidden = fields.introduction.hidden;
    }
    if (aliasesRow) aliasesRow.hidden = !nebula || !aliases;
    // The trail leads to the level that holds the focus's classification (its overview's `holds`).
    const parent = overviewHolding(KNOWN_OVERVIEWS, catalogueClassification(record));
    const parentScope = parent?.id;
    for (const trail of breadcrumbs) trail.hidden = trail.dataset.focusBreadcrumbScope !== parentScope;
    fields.status.hidden = nebula;
    write('status', nebula ? '' : cluster ? record.classification.name : `${words(record.status)} galaxy`);
    const distanceScale = record.distance.valuePc >= 1e6 ? 1e6 : record.distance.valuePc >= 1e3 ? 1e3 : 1;
    write('distance', `${number.format(record.distance.valuePc / distanceScale)} ${distanceScale === 1e6 ? 'Mpc' : distanceScale === 1e3 ? 'kpc' : 'pc'}`);
    const associationLabel = find('[data-focus-fact-label=association]')[0] ?? null;
    if (associationLabel) associationLabel.textContent = cluster ? 'Redshift' : 'Association';
    const distanceLabel = find('[data-focus-fact-label=distance]')[0] ?? null;
    if (distanceLabel) distanceLabel.textContent = cluster ? 'Group distance' : 'Observer distance';
    const { minusPc, plusPc, uncertainty } = record.distance;
    write('uncertainty', uncertainty ? `${number.format(uncertainty.statisticalPc)} pc statistical; ${number.format(uncertainty.systematicPc)} pc systematic`
      : minusPc !== undefined && plusPc !== undefined ? `−${number.format(minusPc)} / +${number.format(plusPc)} pc` : 'Not supplied');
    if (fields.uncertainty.parentElement) fields.uncertainty.parentElement.hidden = !uncertainty && minusPc === undefined && plusPc === undefined;
    if (fields.membership.parentElement) fields.membership.parentElement.hidden = cluster;
    write('membership', cluster ? 'Galaxy cluster' : nebula ? parent?.name ?? '' : words(record.membership.group));
    write('association', cluster ? `${record.redshift.value}` : nebula ? record.kind === 'globular-cluster' ? 'Galactic globular cluster' : 'Galactic nebula' : words(record.membership.subgroup));
    for (const [index, link] of links.entries()) {
      const source = sources[index];
      link.hidden = !source;
      if (sourceRows[index]) sourceRows[index].hidden = !source;
      if (source) { link.href = source.url; link.textContent = source.citation; }
      else { link.removeAttribute('href'); link.textContent = ''; }
    }
  }, adoptBanks() { adopt(); if (presented) card.set(...presented); }, destroy() { events.abort(); currentPresentation = null; presented = null; } };
  return card;
}
