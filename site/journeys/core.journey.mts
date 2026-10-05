/** Core representative journeys through shell links, browser history and native input. */
import type { Journey } from './harness/api.mts';

type Api = Parameters<Journey['run']>[0];
const representatives = [
  { id: 'milky-way', name: 'Milky Way', source: 'dione' },
  { id: 'earth-system', name: 'Earth–Moon system', source: 'dione' },
  { id: 'dione', name: 'Dione', source: 'saturn-system' },
];
const searchExercises = [
  'capability:inAppNavigation',
  'handler:site:navigation:navigation-history:bindNavigationLinks:objectnavigate:1',
  'handler:site:navigation:navigation-history:bindNavigationLinks:objectnavigationquery:1',
];

/** Drive the public router event used by the iPad harness; retain a resident reload witness. */
async function chooseDestination(api: Api, id: string, route: string) {
  await api.page.evaluate(() => { Reflect.set(window, '__journeyDocumentStayed', true); });
  await api.barrier('navigation-ready', route);
  api.setStep(`choose-${id}`);
  await api.fly(id === 'earth-system' ? 'earth' : id);
  await api.barrier(`arrive-${id}`, `/${id}/`);
  await assertResident(api);
}
async function assertResident(api: Api) {
  if (await api.page.evaluate(() => Reflect.get(window, '__journeyDocumentStayed')) !== true)
    throw new Error('Navigation reloaded the document instead of flying');
}

export const journeys: Journey[] = representatives.flatMap<Journey>(({ id, source }) => [
  {
    id: `${id}-navigation`, exercises: searchExercises,
    async run(api) {
      await api.load(`/${source}/`, 'departure');
      await chooseDestination(api, id, `/${source}/`);
    },
  },
  {
    id: `${id}-history`, exercises: [...searchExercises, 'capability:historyDeepLinks',
      'handler:site:navigation:navigation-history:createNavigationHistory:popstate:1'],
    async run(api) {
      await api.load(`/${source}/`, 'departure');
      await chooseDestination(api, id, `/${source}/`);
      // Browser session-history operations reach the application's popstate listener.
      await api.page.evaluate(() => history.back());
      await api.barrier('back', `/${source}/`);
      await assertResident(api);
      await api.page.evaluate(() => history.forward());
      await api.barrier('forward', `/${id}/`);
      await assertResident(api);
    },
  },
  {
    id: `${id}-deep-link`, exercises: ['capability:directLoad', 'capability:historyDeepLinks'],
    async run(api) {
      // The native settings link is supported by both the preview and enhanced shell.
      const query = id === 'milky-way' ? '?settings=1' : '?settings=1&shadows=on';
      const response = await api.load(`/${id}/${query}`, 'deep-link');
      if (!response?.ok()) throw new Error('Deep link did not receive a successful document');
      if (new URL(api.page.url()).searchParams.get('settings') !== '1')
        throw new Error('Router discarded the settings deep link');
      const settings = await api.page.evaluate(html => new DOMParser().parseFromString(html, 'text/html')
        .querySelector('.object-stage')?.getAttribute('data-prepared-settings') ?? null, await response.text());
      if (settings === null) throw new Error('Preview did not serve the settings-bearing view');
      const value: unknown = JSON.parse(settings);
      if (!value || typeof value !== 'object' || id !== 'milky-way' && !('shadows' in value && value.shadows === true))
        throw new Error('Deep link did not restore the requested settings');
    },
  },
  {
    id: `${id}-interrupted`, exercises: ['capability:inAppNavigation', 'capability:interruptedNavigation',
      'handler:site:navigation:navigation-history:bindNavigationLinks:objectnavigate:1',
      'handler:site:navigation:navigation-history:bindNavigationLinks:objectnavigationquery:1'],
    async run(api) {
      await api.load(`/${source}/`, 'departure');
      // These are the public navigation events used by the iPad journey; neither changes location directly.
      await api.page.evaluate(() => { Reflect.set(window, '__journeyDocumentStayed', true); });
      await api.fly(id === 'earth-system' ? 'earth' : id);
      // Acceptance starts asynchronous entry/system preparation; one frame does not prove a flight began.
      const deadline = Date.now() + 20000;
      while (await api.page.locator('.explorer-navigation-progress').getAttribute('aria-hidden') !== 'false') {
        if (Date.now() >= deadline) throw new Error(`Flight to ${id} never exposed pending progress before interruption`);
        await api.frames(1, true);
      }
      await api.fly(source === 'saturn-system' ? 'saturn' : source);
      // Selecting the host already seen as a moon system opens its body; it does not preserve the system address.
      await api.barrier('interrupted-return', source === 'saturn-system' ? '/saturn/' : `/${source}/`);
      await assertResident(api);
    },
  },
  {
    id: `${id}-warm-cache`, exercises: ['capability:directLoad', 'capability:coldWarmCache'],
    async run(api) {
      // The runner supplies a fresh context; the second load keeps that same context and its HTTP cache.
      await api.load(`/${id}/`, 'cold');
      await api.load(`/${id}/`, 'warm');
    },
  },
]);

journeys.push({
  id: 'dione-wheel', exercises: ['capability:wheelTrackpad',
    'handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:wheel:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    const box = await api.page.locator('.object-input-surface').boundingBox();
    if (!box) throw new Error('Missing input surface');
    await api.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    api.setStep('wheel');
    await api.input('wheel', () => api.page.mouse.wheel(0, -120));
    await api.frames(1, true);
    await api.barrier('wheel', '/dione/');
  },
}, {
  id: 'dione-drag', exercises: ['capability:mouse',
    'handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:pointerdown:1',
    'handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:pointermove:1',
    'handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:pointerup:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    const box = await api.page.locator('.object-input-surface').boundingBox();
    if (!box) throw new Error('Missing input surface');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await api.page.mouse.move(x, y);
    await api.page.mouse.down();
    for (let step = 1; step <= 8; step++) {
      await api.page.mouse.move(x + step * 8, y + step * 2);
      await api.frames(1);
    }
    // Hold before release so this input journey does not also become a coast journey.
    await api.frames(12);
    await api.page.mouse.up();
    await api.barrier('drag', '/dione/');
  },
}, {
  id: 'dione-keyboard', exercises: ['capability:keyboard',
    'handler:site:object-browser:createObjectBrowserController:keydown:2'],
  async run(api) {
    await api.load('/dione/', 'direct');
    const field = api.page.locator('.object-sidebar-search');
    await field.fill('Dione');
    await api.barrier('search', '/dione/');
    await field.press('ArrowDown');
    const focused = await api.page.evaluate(() => Boolean(document.activeElement?.closest('.object-browser')));
    if (!focused) throw new Error('Keyboard step did not move focus to search results');
    await api.barrier('keyboard-step', '/dione/');
  },
});
