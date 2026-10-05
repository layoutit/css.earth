/** Native shell inputs, retained panels and responsive information-sheet journeys. */
import { json } from './harness/trace.mts';
import type { Journey } from './harness/api.mts';

type Api = Parameters<Journey['run']>[0];
const settings = ['motion', 'lightCurves', 'surfaceLabels', 'heliosphere', 'illustrationModels'];
const gearId = 'control:site:components:ObjectShell:button:markup:4';
const tabId = 'control:site:components:InformationTabs:input:markup:1';

async function openSettings(api: Api, route: string) {
  api.setStep('settings-open');
  await api.page.locator('.object-settings-action').click();
  if (await api.page.locator('.object-settings-action').getAttribute('aria-expanded') !== 'true') throw new Error('Settings did not open');
  await api.barrier('settings-open', route);
}
async function closeSettings(api: Api, route: string) {
  api.setStep('settings-close');
  await api.input('keydown', () => api.page.keyboard.press('Escape'));
  await api.barrier('settings-close', route);
  if (await api.page.locator('.object-settings-action').getAttribute('aria-expanded') !== 'false') throw new Error('Settings did not close');
}
async function toggleTwice(api: Api, name: string, route: string) {
  const input = api.page.locator(`#object-settings input[name="${name}"]`);
  const before = await input.isChecked();
  api.setStep(`${name.toLowerCase()}-pointer`);
  await input.locator("..").click();
  if (await input.isChecked() === before) throw new Error(`${name} pointer toggle failed`);
  // Motion can keep publishing transforms: inspect permission at a fixed frame, then pause through the native control.
  await api.frames(2, true);
  api.setStep(`${name.toLowerCase()}-keyboard`);
  await input.focus();
  await api.input('keydown', () => api.page.keyboard.press('Space'));
  if (await input.isChecked() !== before) throw new Error(`${name} keyboard toggle failed`);
  await api.barrier(`${name.toLowerCase()}-restored`, route);
}
async function tab(api: Api, id: string, route: string, keyboard = false) {
  api.setStep(id);
  if (keyboard) {
    await api.page.locator(`#${id}`).focus();
    await api.input('keydown', () => api.page.keyboard.press('Space'));
  } else await api.page.locator(`label[for="${id}"]`).click();
  await api.barrier(id, route);
  const radio = api.page.locator(`#${id}`);
  if (!await radio.isChecked()) throw new Error(`Tab ${id} did not select`);
  const panel = await radio.getAttribute('aria-controls');
  if (!panel || !await api.page.locator(`#${panel}`).isVisible()) throw new Error(`Tab ${id} has no visible panel`);
}
async function checkbox(api: Api, selector: string, route: string) {
  const input = api.page.locator(selector), before = await input.isChecked();
  api.setStep('machines-pointer'); await input.locator("..").click();
  if (await input.isChecked() === before) throw new Error('Machines pointer toggle failed');
  await api.barrier('machines-pointer', route);
  api.setStep('machines-keyboard'); await input.focus();
  await api.input('keydown', () => api.page.keyboard.press('Space'));
  if (await input.isChecked() !== before) throw new Error('Machines keyboard toggle failed');
  await api.barrier('machines-restored', route);
}

/** The recorder blocks the popup's external request; verify native activation without fetching outside loopback. */
async function sourceLink(api: Api, selector: string, route: string, name: string, keyboard = false) {
  const link = api.page.locator(selector).filter({ visible: true }).first();
  if (!await link.isVisible()) throw new Error(`Source link is not visible: ${selector}`);
  const href = await link.getAttribute('href');
  if (!href || !/^https?:/u.test(href)) throw new Error('Expected an external published source URL');
  const blocked = api.page.context().waitForEvent('requestfailed', { predicate: request => request.url() === href, timeout: 10000 });
  const popup = api.page.waitForEvent('popup', { timeout: 10000 });
  api.setStep(name);
  if (keyboard) { await link.focus(); await api.input('keydown', () => api.page.keyboard.press('Enter')); }
  else await link.click();
  const [opened] = await Promise.all([popup, blocked]);
  await opened.close();
  await api.barrier(name, route);
}

const definitions: Journey[] = [
  {
    id: 'shell-disclosures', recipe: { object: 'dione', featureQuery: 'Dido' }, exercises: [],
    async run(api) {
      const route = '/dione/'; await api.load(route, 'direct'); api.setStep('feature-search');
      const field = api.page.locator('.object-sidebar-search'); await field.click();
      await api.page.keyboard.type('Dido'); await api.barrier('feature-search', route);
      const panel = api.page.locator('.object-feature-results:not([hidden])');
      const summary = panel.locator(':scope > summary');
      if (!await summary.isVisible()) throw new Error('Named feature disclosure is not visible');
      const before = await panel.getAttribute('open') !== null;
      api.setStep('disclosure-pointer'); await summary.click(); await api.barrier('disclosure-pointer', route);
      if ((await panel.getAttribute('open') !== null) === before) throw new Error('Pointer disclosure did not toggle');
      api.setStep('disclosure-keyboard'); await summary.focus();
      await api.input('keydown', () => api.page.keyboard.press('Space')); await api.barrier('disclosure-keyboard', route);
      if ((await panel.getAttribute('open') !== null) !== before) throw new Error('Keyboard disclosure did not restore openness');
    },
  },
  {
    id: 'shell-system-panels', recipe: { object: 'neptune-system', tabs: ['bodies'] },
    exercises: [tabId],
    async run(api) {
      const route = '/neptune-system/'; await api.load(route, 'direct');
      if (await api.page.locator('.object-information-panel').getAttribute('data-card-subject') !== 'system')
        throw new Error('System page did not present the system card');
      const id = 'neptune-system-bodies-tab';
      api.setStep('system-bodies-pointer'); await api.page.locator(`label[for="${id}"]`).click();
      await api.barrier('system-bodies-pointer', route);
      api.setStep('system-bodies-keyboard'); await api.page.locator(`#${id}`).focus();
      await api.input('keydown', () => api.page.keyboard.press('Space')); await api.barrier('system-bodies-keyboard', route);
      if (!await api.page.locator(`#${id}`).isChecked() || !await api.page.locator('#neptune-system-bodies-content').isVisible())
        throw new Error('The system bodies panel did not remain selected');
    },
  },
  {
    id: 'shell-readout', recipe: { object: 'milky-way', dragPixels: 48, resize: { width: 1200, height: 760 } },
    exercises: ['handler:site:shell:object-shell-client:mountObjectShell:objectmotionchange:1',
      'handler:site:view-readout:createViewReadout:objectmotionchange:1',
      'handler:site:view-readout:createViewReadout:resize:1'],
    async run(api) {
      const route = '/milky-way/'; await api.load(route, 'direct');
      const readout = api.page.locator('[data-view-altitude]');
      if (!await readout.isVisible() || !await readout.textContent() || await readout.textContent() === '—')
        throw new Error('View readout has no camera distance');
      const box = await api.page.locator('.object-input-surface').boundingBox();
      if (!box) throw new Error('Missing exploration surface');
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      api.setStep('readout-drag'); await api.page.mouse.move(x, y);
      await api.input('pointerdown', () => api.page.mouse.down());
      for (let step = 1; step <= 6; step++) { await api.page.mouse.move(x + step * 8, y); await api.frames(1); }
      await api.frames(12); await api.input('pointerup', () => api.page.mouse.up());
      await api.barrier('readout-drag', route);
      api.setStep('readout-resize'); await api.page.setViewportSize({ width: 1200, height: 760 });
      await api.barrier('readout-resize', route);
      if (!await readout.isVisible() || await readout.textContent() === '—') throw new Error('Resize lost the distance readout');
    },
  },
  {
    id: 'shell-showcase', recipe: { object: 'lmc', destination: 'application-random', stop: 'native-keyboard-takeover' },
    exercises: ['control:site:components:ObjectShell:button:markup:3',
      'handler:site:showcase:createShowcaseController:click:1', 'handler:site:showcase:start:dynamic-type:1'],
    async run(api) {
      await api.load('/lmc/', 'direct'); api.setStep('showcase-start');
      const button = api.page.locator('.object-showcase-action'); await button.click();
      if (await button.getAttribute('aria-pressed') !== 'true') throw new Error('Slideshow did not start');
      const startingDeadline = Date.now() + 20000;
      while (await api.page.locator('.explorer-navigation-progress').getAttribute('aria-hidden') !== 'false') {
        if (Date.now() >= startingDeadline) throw new Error('Slideshow did not expose a pending flight');
        await api.frames(1, true);
      }
      api.setStep('showcase-takeover');
      await api.page.locator('.object-sidebar-search').focus();
      await api.input('keydown', () => api.page.keyboard.press('Escape'));
      if (await button.getAttribute('aria-pressed') !== 'false') throw new Error('Keyboard did not stop slideshow');
      // A started flight finishes even after the tour stops; observe its actual route without choosing a destination.
      const deadline = Date.now() + 120000;
      while (await api.page.locator('.explorer-navigation-progress').getAttribute('aria-hidden') !== 'true') {
        if (Date.now() >= deadline) throw new Error('Slideshow flight did not finish after takeover');
        await api.frames(1, true);
      }
      await api.barrier('showcase-stopped', new URL(api.page.url()).pathname);
    },
  },
  {
    id: 'shell-sources', recipe: { object: 'dione', external: 'recorder-blocked-popup' }, exercises: ['control:site:components:SourcesLink:a:markup:1',
      'control:site:components:DatasetContextPanels:a:markup:2', 'control:site:components:ObjectInformationPanel:a:markup:1'],
    async run(api) {
      const route = '/dione/'; await api.load(route, 'direct');
      await sourceLink(api, 'a[data-source-link]', route, 'footer-source');
      await sourceLink(api, 'a[data-source-link]', route, 'footer-source-keyboard', true);
      await sourceLink(api, '.object-facility-image-link', route, 'mission-image');
      await sourceLink(api, '.object-facility-image-link', route, 'mission-image-keyboard', true);
      await sourceLink(api, '.object-facility-emblem', route, 'mission-emblem');
      await sourceLink(api, '.object-facility-emblem', route, 'mission-emblem-keyboard', true);
      await tab(api, 'dione-sources-tab', route);
      await sourceLink(api, '.object-sources-content a', route, 'published-source');
      await sourceLink(api, '.object-sources-content a', route, 'published-source-keyboard', true);
    },
  },
  {
    id: 'shell-links', recipe: { object: 'lmc', external: 'recorder-blocked-popup' },
    exercises: ['control:site:components:ObjectShell:a:markup:3',
      'control:site:components:ObjectCardHeader:a:markup:1', 'control:site:components:DatasetDescription:a:markup:1'],
    async run(api) {
      const route = '/lmc/'; await api.load(route, 'direct');
      await sourceLink(api, '.object-header-link', route, 'header-repository');
      await sourceLink(api, '.object-header-link', route, 'header-repository-keyboard', true);
      await sourceLink(api, '.object-learn-more-link', route, 'learn-more');
      await sourceLink(api, '.object-learn-more-link', route, 'learn-more-keyboard', true);
      await tab(api, 'lmc-dataset-tab', route);
      await sourceLink(api, '.object-dataset-source-link', route, 'dataset-source');
      await sourceLink(api, '.object-dataset-source-link', route, 'dataset-source-keyboard', true);
    },
  },
  {
    id: 'shell-settings', recipe: { object: 'dione', settings }, exercises: [gearId, ...[6, 7, 10, 11, 12].map(ordinal => `control:site:components:ObjectShell:input:markup:${ordinal}`),
      ...['click', 'beforetoggle', 'toggle', 'change'].map(event => `handler:site:shell:shell-settings:createSettingsController:${event}:1`)],
    async run(api) {
      const route = '/dione/'; await api.load(route, 'direct'); await openSettings(api, route);
      for (const name of settings) await toggleTwice(api, name, route);
      await toggleTwice(api, 'shadows', route);
      await closeSettings(api, route);
      api.setStep('gear-keyboard'); await api.page.locator('.object-settings-action').focus();
      await api.input('keydown', () => api.page.keyboard.press('Enter'));
      await api.barrier('gear-keyboard', route);
      if (await api.page.locator('.object-settings-action').getAttribute('aria-expanded') !== 'true') throw new Error('Keyboard settings open failed');
      api.setStep('gear-close-pointer'); await api.page.locator('.object-settings-action').click();
      await api.barrier('gear-close-pointer', route);
      if (await api.page.locator('.object-settings-action').getAttribute('aria-expanded') !== 'false') throw new Error('Pointer settings close failed');
    },
  },
  {
    id: 'shell-panels', recipe: { object: 'dione', dataset: 'enhanced', context: 'voyager-1' }, exercises: [tabId, 'control:site:components:DatasetList:button:markup:1',
      'control:site:components:ObjectShell:input:markup:3', 'handler:site:tab-panels:bindTabPanels:change:2'],
    async run(api) {
      const route = '/dione/'; await api.load(route, 'direct');
      await tab(api, 'dione-factsheet-tab', route); await tab(api, 'dione-sources-tab', route, true);
      await tab(api, 'dione-dataset-tab', route);
      await tab(api, 'dione-normal-voyager-1-tab', route); await tab(api, 'dione-normal-voyager-2-tab', route, true);
      await tab(api, 'dione-normal-cassini-tab', route);
      api.setStep('enhanced-pointer'); await api.page.locator('.object-observation-control[value="enhanced"]').click();
      await api.barrier('enhanced-pointer', route);
      if (await api.page.locator('.object-observation-control[value="enhanced"]').getAttribute('aria-pressed') !== 'true') throw new Error('Enhanced dataset did not select');
      api.setStep('normal-keyboard'); await api.page.locator('.object-observation-control[value="normal"]').focus();
      await api.input('keydown', () => api.page.keyboard.press('Enter')); await api.barrier('normal-keyboard', route);
      if (await api.page.locator('.object-observation-control[value="normal"]').getAttribute('aria-pressed') !== 'true') throw new Error('Keyboard dataset did not select');
      await checkbox(api, '.object-facility-toggle', route);
    },
  },
  {
    id: 'shell-overview', recipe: { object: 'lmc', dataset: 'vista-infrared' }, exercises: [tabId, 'control:site:components:DatasetList:button:markup:1',
      'handler:site:tab-panels:bindTabPanels:change:2'],
    async run(api) {
      const route = '/lmc/'; await api.load(route, 'direct');
      await tab(api, 'lmc-factsheet-tab', route); await tab(api, 'lmc-sources-tab', route, true);
      await tab(api, 'lmc-dataset-tab', route);
      api.setStep('vista'); await api.page.locator('.object-observation-control[value="vista-infrared"]').click();
      await api.barrier('vista', route);
      if (await api.page.locator('.object-observation-control[value="vista-infrared"]').getAttribute('aria-pressed') !== 'true') throw new Error('VISTA dataset did not select');
      await tab(api, 'lmc-bodies-tab', route, true);
    },
  },
  {
    id: 'shell-sheet', recipe: { object: 'dione', viewport: { width: 390, height: 844 }, dragPixels: 180 }, exercises: ['control:site:components:ObjectShell:input:markup:14',
      'control:site:components:DatasetList:select:markup:1',
      ...['pointerdown', 'pointermove', 'pointerup', 'change', 'keydown', 'resize'].map(event => `handler:site:shell:shell-sheet:createSheetController:${event}:1`),
      'handler:site:shell:shell-sheet:createSheetController:change:2',
      'handler:site:shell:shell-sheet:settle:transitionend:1', 'handler:site:tab-panels:bindTabPanels:change:1'],
    async run(api) {
      const route = '/dione/'; await api.load(route, 'direct');
      api.setStep('narrow'); await api.page.setViewportSize({ width: 390, height: 844 }); await api.barrier('narrow', route);
      const handle = api.page.locator('.object-sheet-handle');
      api.setStep('sheet-open'); await handle.click(); await api.frames(32, true); await api.barrier('sheet-open', route);
      if (await api.page.locator('body').getAttribute('data-sheet') !== 'full') throw new Error('Sheet pointer open failed');
      api.setStep('sheet-keyboard'); await handle.focus(); await api.input('keydown', () => api.page.keyboard.press('ArrowDown'));
      await api.frames(32, true); await api.barrier('sheet-half', route);
      if (await api.page.locator('body').getAttribute('data-sheet') !== 'half') throw new Error('Sheet ArrowDown did not reach half');
      const box = await handle.boundingBox(); if (!box) throw new Error('Sheet handle is missing');
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      api.setStep('sheet-drag'); await api.page.mouse.move(x, y);
      await api.input('pointerdown', () => api.page.mouse.down());
      for (let step = 1; step <= 6; step++) { await api.page.mouse.move(x, y + step * 30); await api.frames(2); }
      await api.input('pointerup', () => api.page.mouse.up()); await api.frames(32, true); await api.barrier('sheet-drag', route);
      if (await api.page.locator('body').getAttribute('data-sheet') === 'half') throw new Error('Sheet drag did not change stop');
      api.setStep('sheet-full'); await handle.focus();
      for (let step = 0; step < 3; step++) { await api.input('keydown', () => api.page.keyboard.press('ArrowUp')); await api.frames(32, true); }
      await api.barrier('sheet-full', route);
      if (await api.page.locator('body').getAttribute('data-sheet') !== 'full') throw new Error('Sheet keyboard open failed');
      api.setStep('native-dataset'); const select = api.page.locator('.object-dataset-native-select'); await select.focus();
      // The platform's select popup consumes its own keys before DOM keydown; use native keyboard delivery directly.
      await select.click(); await api.page.keyboard.press('e'); await api.page.keyboard.press('Enter');
      await api.barrier('native-dataset', route);
      if (await api.page.locator('.object-dataset-native-select').inputValue() !== 'enhanced') throw new Error(`Native dataset selection failed: ${await api.page.locator('.object-dataset-native-select').inputValue()}`);
      api.setStep('wide'); await api.page.setViewportSize({ width: 1280, height: 800 }); await api.barrier('wide', route);
    },
  },
  ...['earth-system', 'neptune-system', 'mars-system'].map((object): Journey => ({
    id: `shell-${object}-settings`, recipe: { object }, exercises: [gearId, 'control:site:components:ObjectShell:input:markup:8'],
    async run(api) {
      const route = `/${object}/`; await api.load(route, 'direct'); await openSettings(api, route);
      await toggleTwice(api, 'shadows', route);
      if (object !== 'earth-system') await toggleTwice(api, object === 'neptune-system' ? 'rings' : 'atmosphere', route);
      api.setStep('motion-enable'); await api.page.locator('.object-motion-setting-control').click();
      const speed = api.page.locator('.object-speed-setting');
      if (!await speed.isEnabled()) throw new Error('Motion did not enable speed');
      api.setStep('speed-keyboard'); await speed.focus(); await api.input('keydown', () => api.page.keyboard.press('End'));
      if (await speed.inputValue() !== '4') throw new Error('Speed keyboard input failed');
      const box = await speed.boundingBox(); if (!box) throw new Error('Speed slider is missing');
      api.setStep('speed-pointer'); await api.page.mouse.click(box.x + 2, box.y + box.height / 2);
      if (await speed.inputValue() !== '0') throw new Error('Speed pointer input failed');
      await api.page.locator('.object-motion-setting-control').click(); await api.barrier('motion-paused', route);
      if (await speed.isEnabled()) throw new Error('Pausing motion did not disable speed');
      await closeSettings(api, route);
    },
  })),
  {
    id: 'shell-sequence', recipe: { object: 'neptune-system', host: 'neptune', dataset: 'visible-2017a', step: 'visible-2018a', playback: 'require-committed-next-step' }, exercises: ['control:site:components:DatasetList:button:markup:1',
      'control:site:components:SequencePlayer:button:markup:1'],
    async run(api) {
      await api.load('/neptune-system/', 'direct'); api.setStep('select-host');
      await api.page.locator('.object-information-panel a.object-link[data-object-id="neptune"]').click();
      const route = '/neptune/'; await api.barrier('select-host', route);
      api.setStep('sequence-select'); await api.page.locator('.object-observation-control[value="visible-2017a"]').click(); await api.barrier('sequence-select', route);
      api.setStep('sequence-step'); await api.page.locator('[data-dataset-step="visible-2018a"]').click(); await api.barrier('sequence-step', route);
      if (await api.page.locator('[data-dataset-step="visible-2018a"]').getAttribute('aria-current') !== 'step') throw new Error('Sequence step failed');
      api.setStep('sequence-play'); await api.page.locator('[data-dataset-play]').click();
      if (await api.page.locator('[data-dataset-play]').getAttribute('aria-pressed') !== 'true') throw new Error('Sequence play failed');
      // A pressed button alone does not prove playback. Wait for the application's timer to commit another date.
      const playbackDeadline = Date.now() + 120000;
      while (await api.page.locator('[data-dataset-step][aria-current="step"]').getAttribute('data-dataset-step') === 'visible-2018a') {
        if (Date.now() >= playbackDeadline) throw new Error('Playing sequence never advanced its committed step');
        await api.frames(1, true);
      }
      api.setStep('sequence-pause'); await api.page.locator('[data-dataset-play]').focus(); await api.input('keydown', () => api.page.keyboard.press('Space'));
      await api.barrier('sequence-pause', route);
      if (await api.page.locator('[data-dataset-play]').getAttribute('aria-pressed') !== 'false') throw new Error('Sequence pause failed');
      api.setStep('sequence-keyboard-step'); await api.page.locator('[data-dataset-step="visible-2017a"]').focus(); await api.input('keydown', () => api.page.keyboard.press('Enter'));
      await api.barrier('sequence-keyboard-step', route);
      if (await api.page.locator('[data-dataset-step="visible-2017a"]').getAttribute('aria-current') !== 'step') throw new Error('Keyboard sequence step failed');
    },
  },
];

// Qualification must bind shared action helpers as well as each closure's object recipe.
export const journeys: Journey[] = definitions.map(journey => ({ ...journey, recipe: json({ actions: journey.recipe ?? null, helpers: [openSettings, closeSettings, toggleTwice, tab, checkbox, sourceLink].map(String) }) }));
