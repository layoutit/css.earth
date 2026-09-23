import { isPreparedCluster, isPreparedNebula } from '@cssearth/catalog';
import type { PreparedCatalogObject, SpatialCitation } from '@cssearth/catalog';
import { preparedFocusObjectId } from './prepared-focus.mts';
import type { PreparedFocusPresentation } from './prepared-focus.mts';
import { requiredElement } from './browser-types.mts';

interface PreparedFocusCard {
  set(record: PreparedCatalogObject | null, sources?: readonly SpatialCitation[], presentation?: PreparedFocusPresentation | null): void;
  /** Adopt dataset banks spliced in after mount (`focus-fragment.mts`) and present the current record again. */
  adoptBanks(): void;
  destroy(): void;
}

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });
const words = (value: string) => value.replaceAll('-', ' ').replace(/^./u, letter => letter.toUpperCase());

/** One retained card transports the selected prepared record; no catalogue is imported here. */
export function createPreparedFocusCard(root: HTMLElement | null, showTab: (id: string) => void = () => {}): PreparedFocusCard {
  if (!root) return { set() {}, adoptBanks() {}, destroy() {} };
  const fields = Object.fromEntries(['name', 'aliases', 'introduction', 'status', 'distance', 'uncertainty', 'membership', 'association']
    .map(name => [name, requiredElement(root, `[data-focus-${name}]`)]));
  const aliasesRow = root.querySelector<HTMLElement>('[data-focus-aliases-row]');
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-focus-source]')];
  const sourceRows = [...root.querySelectorAll<HTMLElement>('[data-focus-source-row]')];
  const breadcrumbs = [...root.querySelectorAll<HTMLElement>('[data-focus-breadcrumb-scope]')];
  const events = new AbortController();
  const unavailable = root.querySelector<HTMLElement>('[data-focus-unavailable]');
  const unavailableIds = new Set(unavailable?.dataset.unavailableObjects?.split(' ') ?? []);
  let currentPresentation: PreparedFocusPresentation | null = null;
  const datasetTab = root.querySelector<HTMLElement>('[data-information-tab="dataset"]');
  let currentRecordId: string | undefined;
  type Bank = { root: HTMLElement; buttons: HTMLButtonElement[]; details: HTMLElement[]; contexts: HTMLElement[] };
  const banks: Bank[] = [];
  const adopt = () => {
    for (const element of root.querySelectorAll<HTMLElement>('[data-focus-lens-bank], [data-focus-facts-bank]')) {
      if (banks.some(bank => bank.root === element)) continue;
      const bank = { root: element,
        buttons: [...element.querySelectorAll<HTMLButtonElement>('[data-focus-lens]')],
        details: [...element.querySelectorAll<HTMLElement>('[data-focus-lens-details]')],
        contexts: [...element.querySelectorAll<HTMLElement>('[data-dataset-context]')],
      };
      for (const button of bank.buttons) button.addEventListener('click', event => {
        if (currentPresentation && currentPresentation.objectId === bank.root.dataset.focusLensBank) {
          event.preventDefault(); currentPresentation.selectLens(button.getAttribute('value') ?? '');
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
    if (datasetTab) datasetTab.hidden = !currentPresentation;
    if (record && (record.id !== currentRecordId || previous !== currentPresentation?.objectId))
      showTab(currentPresentation ? 'dataset' : 'factsheet');
    currentRecordId = record?.id;
    for (const bank of banks) {
      const active = currentPresentation?.objectId === (bank.root.dataset.focusLensBank ?? bank.root.dataset.focusFactsBank);
      bank.root.hidden = !active;
      if (!active || !currentPresentation) continue;
      const available = new Set(currentPresentation.lenses.map(lens => lens.id));
      for (const button of bank.buttons) {
        // Read the prepared attribute in both the server DOM and the live browser.
        const lens = button.getAttribute('value') ?? '';
        button.disabled = !available.has(lens);
        const pressed = String(lens === currentPresentation.selectedLens);
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
      }
      for (const detail of bank.details) detail.hidden = detail.dataset.focusLensDetails !== currentPresentation.selectedLens;
      for (const context of bank.contexts) context.hidden = context.dataset.datasetContext !== currentPresentation.selectedLens;
    }
  };
  const write = (name: string, value: string) => { if (fields[name].textContent !== value) fields[name].textContent = value; };
  const card: PreparedFocusCard = { set(record, sources = [], presentation = null) {
    presented = [record, sources, presentation];
    setPresentation(record, presentation);
    if (unavailable) {
      const objectId = record && preparedFocusObjectId(record);
      const missing = objectId && unavailableIds.has(objectId);
      unavailable.hidden = !missing;
      unavailable.textContent = missing ? `The 3D view of ${record.name} is unavailable in this installation. Catalogue facts remain available.` : '';
    }
    if (!record) { root.hidden = true; return; }
    root.dataset.preparedFocusId = record.id;
    for (const bank of root.querySelectorAll<HTMLElement>('[data-focus-record-bank]')) bank.hidden = bank.dataset.focusRecordBank !== record.id;
    const cluster = isPreparedCluster(record), nebula = isPreparedNebula(record);
    const aliases = record.aliases.join(', ');
    write('name', record.name);
    write('aliases', aliases);
    write('introduction', nebula ? record.introduction.text : aliases ? `Also known as ${aliases}` : '');
    fields.introduction.hidden = !nebula && !aliases;
    if (aliasesRow) aliasesRow.hidden = !nebula || !aliases;
    const parentScope = cluster ? 'nearby-universe' : nebula ? 'milky-way' : 'local-group';
    for (const trail of breadcrumbs) trail.hidden = trail.dataset.focusBreadcrumbScope !== parentScope;
    fields.status.hidden = nebula;
    write('status', nebula ? '' : cluster ? record.classification.name : `${words(record.status)} galaxy`);
    const distanceScale = record.distance.valuePc >= 1e6 ? 1e6 : record.distance.valuePc >= 1e3 ? 1e3 : 1;
    write('distance', `${number.format(record.distance.valuePc / distanceScale)} ${distanceScale === 1e6 ? 'Mpc' : distanceScale === 1e3 ? 'kpc' : 'pc'}`);
    const associationLabel = root.querySelector<HTMLElement>('[data-focus-fact-label=association]');
    if (associationLabel) associationLabel.textContent = cluster ? 'Redshift' : 'Association';
    const distanceLabel = root.querySelector<HTMLElement>('[data-focus-fact-label=distance]');
    if (distanceLabel) distanceLabel.textContent = cluster ? 'Comoving distance' : 'Observer distance';
    const { minusPc, plusPc, uncertainty } = record.distance;
    write('uncertainty', uncertainty ? `${number.format(uncertainty.statisticalPc)} pc statistical; ${number.format(uncertainty.systematicPc)} pc systematic`
      : minusPc !== undefined && plusPc !== undefined ? `−${number.format(minusPc)} / +${number.format(plusPc)} pc` : 'Not supplied');
    if (fields.uncertainty.parentElement) fields.uncertainty.parentElement.hidden = !uncertainty && minusPc === undefined && plusPc === undefined;
    if (fields.membership.parentElement) fields.membership.parentElement.hidden = cluster;
    write('membership', cluster ? 'Galaxy cluster' : nebula ? 'Milky Way' : words(record.membership.group));
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
