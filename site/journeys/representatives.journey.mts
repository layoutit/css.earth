/** S0 representatives: native settings and dataset controls after a cold direct load. */
import { json } from './harness/trace.mts';
import type { Journey } from './harness/api.mts';

export const representatives = [
  { id: 'lmc', startup: 'serverAdoption', dataset: 'vista-infrared' },
  { id: 'neptune-system', host: 'neptune', startup: 'runtimeMount', dataset: 'visible-2017a', step: 'visible-2018a' },
  { id: 'beta-pictoris-system', host: 'beta-pictoris', startup: 'runtimeMount', dataset: 'debris-disc-color', legend: true },
  { id: 'asteroid-2001-sn263-system', host: 'asteroid-2001-sn263', startup: 'runtimeMount', dataset: 'shape', single: true },
  { id: 'mars-system', host: 'mars', startup: 'runtimeMount', dataset: 'chlorine', step: 'iron' },
  { id: 'observable-universe', startup: 'serverAdoption', dataset: 'cutaway', legend: true, tab: true },
  { id: 'abell-1689', startup: 'serverAdoption', dataset: 'optical', single: true },
  { id: 'centaurus-cluster', startup: 'serverAdoption', dataset: 'members', single: true },
  { id: 'great-attractor', startup: 'serverAdoption', dataset: 'galaxies', single: true },
  { id: 'local-group', startup: 'serverAdoption', dataset: 'galaxies', single: true, tab: true },
];

/** This tranche owns these five only; the preceding recipes remain available to their owner. */
export const ownedRepresentatives = [
  { id: 'great-attractor', name: 'Great Attractor', datasets: ['galaxies'], tab: false },
  { id: 'local-group', name: 'Local Group', datasets: ['galaxies'], tab: true },
  { id: 'observable-universe', name: 'Observable Universe', datasets: ['cutaway', 'full', 'off'], tab: true },
  { id: 'abell-1689', name: 'Abell 1689', datasets: ['optical'], tab: false },
  { id: 'centaurus-cluster', name: 'Centaurus Cluster', datasets: ['members'], tab: false },
];
type Api = Parameters<Journey['run']>[0];
type Representative = typeof ownedRepresentatives[number];

/** Native inputs only; inspect each committed dataset, including every CMB sphere bank. */
async function controls(api: Api, representative: Representative, resources: Set<string>) {
  const route = `/${representative.id}/`;
  api.setStep('settings-open');
  const gear = api.page.locator('.object-settings-action');
  await gear.click();
  await api.barrier('settings-open', route);
  if (await gear.getAttribute('aria-expanded') !== 'true' || !await api.page.locator('.object-settings-panel').isVisible())
    throw new Error('Native settings panel did not open');
  api.setStep('settings-close');
  await api.page.keyboard.press('Escape');
  await api.barrier('settings-close', route);
  if (await gear.getAttribute('aria-expanded') !== 'false' || await api.page.locator('.object-settings-panel').count() !== 0)
    throw new Error('Closed settings panel remained mounted');
  if (representative.tab) {
    api.setStep('dataset-tab');
    await api.page.locator(`label[for="${representative.id}-dataset-tab"]`).click();
    await api.barrier('dataset-tab', route);
    if (!await api.page.locator(`#${representative.id}-dataset-tab`).isChecked()) throw new Error('Dataset tab did not open');
  }
  for (const dataset of representative.datasets) {
    const step = `dataset-${dataset}`;
    api.setStep(step);
    const button = api.page.locator(`.object-observation-control[value="${dataset}"]`);
    if (representative.datasets.length > 1 && await button.getAttribute('aria-pressed') !== 'false')
      throw new Error(`Dataset ${dataset} must switch from another bank`);
    await button.click();
    await api.barrier(step, route);
    if (await button.getAttribute('aria-pressed') !== 'true') throw new Error(`Dataset ${dataset} did not commit`);
    if (!await api.page.locator(`[data-dataset-details="${dataset}"]`).isVisible())
      throw new Error(`Dataset ${dataset} details did not mount`);
    if (representative.id === 'observable-universe' && dataset !== 'off'
      && !await api.page.locator('[data-dataset-legend]').first().isVisible()) throw new Error('Selected CMB legend is missing');
    await bankWitness(api, representative, dataset, resources);
  }
}

/** Require actual transport and painted/resident geometry, rather than a pressed dataset button alone. */
export async function bankWitness(api: Pick<Api, 'page'>, representative: Representative, dataset: string, resources: Set<string>) {
  const transports: Record<string, string> = {
    'great-attractor': '/src/objects/nearby-universe-galaxies/prepared/dots.bin',
    'local-group': '/catalogues/dots.bin',
    'observable-universe': '/src/objects/observable-universe-cmb/prepared/cmb.json',
    'abell-1689': '/src/objects/abell-1689-layers/prepared/image-layers.json',
    'centaurus-cluster': '/src/objects/centaurus-cluster-members/prepared/dots.bin',
  };
  if (!resources.has(transports[representative.id]!)) throw new Error(`${representative.id} bank transport did not succeed`);
  const painted = await api.page.evaluate(({ id, dataset }) => {
    const drawn = (element: Element) => {
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    if (id === 'abell-1689') return [...document.querySelectorAll('[data-image-layer-object="abell-1689-layers"] [data-image-layer-leaf]')]
      .some(element => drawn(element) && getComputedStyle(element).backgroundImage !== 'none');
    if (id === 'local-group') return [...document.querySelectorAll('.prepared-galaxy-catalog [data-galaxy-dot]')].some(drawn);
    if (id === 'observable-universe') {
      const sphere = document.querySelector('[data-image-mesh="cmb"]');
      const interior = document.querySelector('[data-image-mesh-interior]');
      if (!sphere || !interior) return false;
      if (dataset === 'off') return !drawn(sphere) && !drawn(interior);
      const leaves = [...sphere.querySelectorAll('s')];
      return drawn(sphere) && leaves.some(element => drawn(element) && getComputedStyle(element).backgroundImage !== 'none')
        && (dataset === 'cutaway' ? drawn(interior) && leaves.some(element => !drawn(element))
          : !drawn(interior) && leaves.every(drawn));
    }
    // These two banks use a generic dots id. Successful source transport plus painted point paths
    // proves residency here; precise per-bank attribution is requested from the harness owner.
    return [...document.querySelectorAll('[data-catalogue-points="dots"] path')].some(element =>
      drawn(element) && element.getAttribute('d') && Number(getComputedStyle(element).strokeOpacity) > 0);
  }, { id: representative.id, dataset });
  if (!painted) throw new Error(`${representative.id}/${dataset} bank did not publish its selected geometry`);
}

const controlExercises = [
  'control:site:components:ObjectShell:button:markup:4',
  'handler:site:shell:shell-settings:createSettingsController:click:1',
  'handler:site:shell:shell-settings:createSettingsController:beforetoggle:1',
  'handler:site:shell:shell-settings:createSettingsController:toggle:1',
  'control:site:components:DatasetList:button:markup:1',
  'handler:packages:renderer:src:rendering:object-control-binding:createObjectControlBinding:click:1',
];

export const journeys: Journey[] = representatives.filter(row => !ownedRepresentatives.some(owned => owned.id === row.id)).map(representative => ({
  id: representative.id, recipe: json(representative),
  // Opening and closing the native popover drive these three listeners. Desktop dataset clicks
  // are bound by object-control-binding, not the narrow layout's native-select change listener.
  exercises: ['capability:directLoad', `capability:${representative.startup}`,
    'control:site:components:ObjectShell:button:markup:4',
    'handler:site:shell:shell-settings:createSettingsController:click:1',
    'handler:site:shell:shell-settings:createSettingsController:beforetoggle:1',
    'handler:site:shell:shell-settings:createSettingsController:toggle:1',
    'control:site:components:DatasetList:button:markup:1',
    'handler:packages:renderer:src:rendering:object-control-binding:createObjectControlBinding:click:1',
    ...(representative.tab ? ['control:site:components:InformationTabs:input:markup:1',
      'handler:site:tab-panels:bindTabPanels:change:2'] : []),

  ],
  async run(api) {
    let route = `/${representative.id}/`;
    await api.load(route, 'direct');
    if (representative.host) {
      api.setStep('select-host');
      await api.page.locator(`.object-information-panel a.object-link[data-object-id="${representative.host}"]`).click();
      route = `/${representative.host}/`;
      await api.barrier('select-host', route);
      if (await api.page.locator('.object-information-panel').getAttribute('data-card-subject') !== 'body')
        throw new Error('Native host selection did not open its body card');
    }
    api.setStep('settings-open');
    const gear = api.page.locator('.object-settings-action');
    await gear.click();
    if (await gear.getAttribute('aria-expanded') !== 'true') throw new Error('Settings did not open');
    await api.barrier('settings-open', route);
    api.setStep('settings-close');
    await api.page.keyboard.press('Escape');
    await api.barrier('settings-close', route);
    if (await gear.getAttribute('aria-expanded') !== 'false') throw new Error('Settings did not close');
    if (representative.tab) {
      api.setStep('dataset-tab');
      const tab = api.page.locator(`#${representative.host ?? representative.id}-dataset-tab`);
      await api.page.locator(`label[for="${representative.host ?? representative.id}-dataset-tab"]`).click();
      await api.barrier('dataset-tab', route);
      if (!await tab.isChecked()) throw new Error('Dataset tab did not open');
    }
    api.setStep('dataset');
    const button = api.page.locator(`.object-observation-control[value="${representative.dataset}"]`);
    const before = await button.getAttribute('aria-pressed');
    if (!representative.single && before !== 'false') throw new Error('Dataset switch must start on another dataset');
    await button.click();
    await api.barrier('dataset', route);
    if (await button.getAttribute('aria-pressed') !== 'true') throw new Error('Dataset selection did not commit');
    if (representative.step) {
      api.setStep('dataset-step');
      const step = api.page.locator(`[data-dataset-step="${representative.step}"]`);
      await step.click();
      await api.barrier('dataset-step', route);
      if (await api.page.locator(`[data-dataset-step="${representative.step}"]`).getAttribute('aria-current') !== 'step')
        throw new Error('Dataset step did not commit');
    }
    // Legends are static DatasetLegend panels: no toggle is bound. Require the selected legend.
    if (representative.legend && !await api.page.locator('[data-dataset-legend]').first().isVisible())
      throw new Error('Selected dataset legend is missing');
  },
}));

/** Separate pairs isolate direct adoption, native resident navigation and served settings links. */
journeys.push(...ownedRepresentatives.flatMap<Journey>(representative =>
  (['direct', 'navigation', 'deep-link'] as const).map(startup => ({
    id: startup === 'direct' ? representative.id : `${representative.id}-${startup}`,
    // Bind helper code as well as closure data to the measured qualification recipe.
    recipe: json({ representative, startup, controls: String(controls), bankWitness: String(bankWitness) }),
    exercises: [
      'capability:directLoad', startup === 'deep-link' ? 'capability:runtimeMount' : 'capability:serverAdoption', ...controlExercises,
      ...(representative.tab ? ['control:site:components:InformationTabs:input:markup:1',
        'handler:site:tab-panels:bindTabPanels:change:2'] : []),
      ...(startup === 'deep-link' ? ['capability:historyDeepLinks'] : []),
      ...(startup === 'navigation' ? [
        'control:site:components:ObjectShell:input:markup:2',
        'handler:site:object-browser:createObjectBrowserController:input:1',
        'handler:site:navigation:navigation-history:bindNavigationLinks:click:1',
      ] : []),
    ],
    async run(api) {
      const route = `/${representative.id}/`;
      const resources = new Set<string>();
      const onResponse = (value: import('playwright').Response) => { if (value.ok()) resources.add(new URL(value.url()).pathname); };
      api.page.on('response', onResponse);
      try {
        if (startup === 'navigation') {
          const departure = representative.id === 'local-group' ? '/great-attractor/' : '/local-group/';
          await api.load(departure, 'departure');
          // A private witness value observes document retention; it does not drive the app.
          await api.page.evaluate(() => { Reflect.set(window, '__representativeResident', true); });
          api.setStep('search-destination');
          await api.page.locator('.object-sidebar-search').fill(representative.name);
          await api.barrier('search-destination', departure);
          api.setStep('select-destination');
          const destination = api.page.locator(`.object-browser a[href="${route}"]`).first();
          await destination.click();
          await api.barrier('arrival', route);
          if (await api.page.evaluate(() => Reflect.get(window, '__representativeResident')) !== true)
            throw new Error('Native destination link reloaded instead of mounting in the resident document');
        } else {
          const response = await api.load(route + (startup === 'deep-link' ? '?settings=1' : ''), startup);
          if (!response?.ok()) throw new Error('Representative document did not load successfully');
          if (startup === 'deep-link') {
            const prepared = await api.page.evaluate(html => new DOMParser().parseFromString(html, 'text/html')
              .querySelector('.object-stage')?.getAttribute('data-prepared-settings'), await response.text());
            if (prepared === null || prepared === undefined) throw new Error('Settings link did not serve prepared settings');
            const settings: unknown = JSON.parse(prepared);
            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Invalid served prepared settings');
            await api.deepLinkWitness();
          }
        }
        await controls(api, representative, resources);
      } finally { api.page.off('response', onResponse); }
    },
  })),
));
