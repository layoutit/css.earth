import { isPreparedCluster, isPreparedNebula } from '@cssearth/catalog';
import type { PreparedCatalogObject, SpatialCitation } from '@cssearth/catalog';
import type { PreparedFocusPresentation } from './prepared-context-navigation.mts';
import { requiredElement } from './browser-types.mts';

interface PreparedFocusCard {
  set(record: PreparedCatalogObject | null, sources?: readonly SpatialCitation[], presentation?: PreparedFocusPresentation | null): void;
  destroy(): void;
}

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });
const words = (value: string) => value.replaceAll('-', ' ').replace(/^./u, letter => letter.toUpperCase());

/** One retained card transports the selected prepared record; no catalogue is imported here. */
export function createPreparedFocusCard(root: HTMLElement | null, showTab: (id: string) => void = () => {}): PreparedFocusCard {
  if (!root) return { set() {}, destroy() {} };
  const fields = Object.fromEntries(['name', 'aliases', 'status', 'distance', 'uncertainty', 'membership', 'association', 'basis', 'reference']
    .map(name => [name, requiredElement(root, `[data-focus-${name}]`)]));
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-focus-source]')];
  const sourceRows = [...root.querySelectorAll<HTMLElement>('[data-focus-source-row]')];
  const breadcrumbs = [...root.querySelectorAll<HTMLElement>('[data-focus-breadcrumb-scope]')];
  const events = new AbortController();
  const unavailable = root.querySelector<HTMLElement>('[data-focus-unavailable]');
  const unavailableIds = new Set(unavailable?.dataset.unavailableObjects?.split(' ') ?? []);
  let currentPresentation: PreparedFocusPresentation | null = null;
  const datasetTab = root.querySelector<HTMLElement>('[data-information-tab="dataset"]');
  let currentRecordId: string | undefined;
  const banks = [...root.querySelectorAll<HTMLElement>('[data-focus-lens-bank], [data-focus-facts-bank]')].map(bank => ({ root: bank,
    buttons: [...bank.querySelectorAll<HTMLButtonElement>('[data-focus-lens]')],
    details: [...bank.querySelectorAll<HTMLElement>('[data-focus-lens-details]')],
    stars: bank.querySelector<HTMLInputElement>('[data-focus-stars]'),
  }));
  for (const bank of banks) {
    for (const button of bank.buttons) button.addEventListener('click', event => {
      if (currentPresentation && currentPresentation.objectId === bank.root.dataset.focusLensBank) {
        event.preventDefault(); currentPresentation.selectLens(button.value);
      }
    }, { signal: events.signal });
    bank.stars?.addEventListener('change', () => {
      if (currentPresentation && currentPresentation.objectId === bank.root.dataset.focusLensBank) currentPresentation.setStarsVisible?.(bank.stars!.checked);
    }, { signal: events.signal });
  }
  const setPresentation = (record: PreparedCatalogObject | null, presentation: PreparedFocusPresentation | null) => {
    const previous = currentPresentation?.objectId;
    currentPresentation = record && !isPreparedCluster(record) && record.detailedObjectId === presentation?.objectId ? presentation : null;
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
        button.disabled = !available.has(button.value);
        const pressed = String(button.value === currentPresentation.selectedLens);
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
      }
      for (const detail of bank.details) detail.hidden = detail.dataset.focusLensDetails !== currentPresentation.selectedLens;
      if (bank.stars) {
        bank.stars.disabled = typeof currentPresentation.setStarsVisible !== 'function';
        bank.stars.checked = currentPresentation.starsVisible;
      }
    }
  };
  const write = (name: string, value: string) => { if (fields[name].textContent !== value) fields[name].textContent = value; };
  return { set(record, sources = [], presentation = null) {
    setPresentation(record, presentation);
    if (unavailable) {
      const missing = record && !isPreparedCluster(record) && record.detailedObjectId && unavailableIds.has(record.detailedObjectId);
      unavailable.hidden = !missing;
      unavailable.textContent = missing ? `The 3D view of ${record.name} is unavailable in this installation. Catalogue facts remain available.` : '';
    }
    if (!record) { root.hidden = true; return; }
    root.dataset.preparedFocusId = record.id;
    for (const bank of root.querySelectorAll<HTMLElement>('[data-focus-record-bank]')) bank.hidden = bank.dataset.focusRecordBank !== record.id;
    write('name', record.name);
    write('aliases', record.aliases.length ? `Also known as ${record.aliases.join(', ')}` : '');
    fields.aliases.hidden = record.aliases.length === 0;
    const cluster = isPreparedCluster(record), nebula = isPreparedNebula(record);
    const parentScope = cluster ? 'nearby-universe' : nebula ? 'milky-way' : 'local-group';
    for (const trail of breadcrumbs) trail.hidden = trail.dataset.focusBreadcrumbScope !== parentScope;
    write('status', cluster || nebula ? record.classification.name : `${words(record.status)} galaxy`);
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
    write('basis', cluster || nebula ? `${record.classification.basis} ${record.distance.method}` : record.membership.basis);
    write('reference', `Distance reference: ${record.distance.sourceRef}`);
    for (const [index, link] of links.entries()) {
      const source = sources[index];
      link.hidden = !source;
      if (sourceRows[index]) sourceRows[index].hidden = !source;
      if (source) { link.href = source.url; link.textContent = source.citation; }
      else { link.removeAttribute('href'); link.textContent = ''; }
    }
  }, destroy() { events.abort(); currentPresentation = null; } };
}
