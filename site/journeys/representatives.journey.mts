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

export const journeys: Journey[] = representatives.map(representative => ({
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
