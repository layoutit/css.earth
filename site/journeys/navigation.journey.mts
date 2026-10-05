/** Native navigation and search paths. Receipts, never declarations, determine coverage. */
import type { Journey } from './harness/api.mts';
import { comparePng } from './harness/differ.mts';

export const journeys: Journey[] = [{
  id: 'navigation-search',
  exercises: [
    'capability:directLoad', 'capability:keyboard',
    'handler:site:object-browser:createObjectBrowserController:focus:1',
    'handler:site:object-browser:createObjectBrowserController:input:1',
    'handler:site:object-browser:createObjectBrowserController:keydown:2',
    'handler:site:object-browser:createObjectBrowserController:keydown:3',
    'handler:site:object-browser:createObjectBrowserController:click:1',
  ],
  async run(api) {
    await api.load('/dione/', 'direct');
    const field = api.page.locator('.object-sidebar-search');
    api.setStep('type-query');
    await field.click();
    await field.pressSequentially('Dione');
    await api.barrier('typed-results', '/dione/');
    const result = api.page.locator('[data-catalogue-list] a[data-object-id="dione"]');
    if (!await result.isVisible()) throw new Error('Typed search did not show Dione');
    api.setStep('result-focus');
    await api.input('keydown', () => field.press('ArrowDown'));
    if (!await api.page.locator('.object-browser').evaluate(node => node.contains(document.activeElement)))
      throw new Error('ArrowDown did not focus a result');
    await api.input('keydown', () => api.page.keyboard.press('ArrowDown'));
    await api.input('keydown', () => api.page.keyboard.press('ArrowUp'));
    await api.input('keydown', () => api.page.keyboard.press('Escape'));
    await api.barrier('results-escape', '/dione/');
    if (await result.isVisible()) throw new Error('Escape did not close results');
    api.setStep('submit-query');
    // Results are closed, so Enter submits rather than selecting the first row.
    await field.press('Enter');
    await api.barrier('submitted-results', '/dione/');
    if (!await result.isVisible()) throw new Error('Enter did not reopen the query');
    api.setStep('clear-query');
    await api.page.locator('.object-sidebar-search-clear').click();
    await api.barrier('cleared', '/dione/');
    if (await field.inputValue() !== '' || await result.isVisible()) throw new Error('Clear did not empty and close search');

  },
}, {
  id: 'navigation-links-history',
  exercises: ['capability:directLoad',
    'handler:site:navigation:navigation-history:bindNavigationLinks:click:1',
    'handler:site:navigation:navigation-history:createNavigationHistory:popstate:1',
    'handler:site:navigation:navigation-fragments:bindNavigationIntent:pointerdown:1',
    'handler:site:navigation:navigation-fragments:bindNavigationIntent:pointerover:1',
    'handler:site:navigation:navigation-fragments:bindNavigationIntent:focusin:1'],
  async run(api) {
    await api.load('/saturn-system/', 'departure');
    await api.page.evaluate(() => { Reflect.set(window, '__navigationResident', true); });
    const before = await api.page.evaluate(() => history.length);
    const link = api.page.locator('.object-information-panel a[data-object-id="dione"]');
    api.setStep('link-intent');
    await link.hover();
    await api.frames(20, true);
    // macOS WebKit uses Option-Tab to include links in its native focus order.
    const tab = api.page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab';
    for (let tabs = 0; !await link.evaluate(node => node === document.activeElement); tabs++) {
      if (tabs >= 80) throw new Error('Native Tab order never reached the visible Dione link');
      await api.input('keydown', () => api.page.keyboard.press(tab));
      await api.frames(1, true);
    }
    await api.frames(20, true);
    api.setStep('link-select');
    await link.click();
    await api.barrier('arrive-dione', '/dione/');
    if (await api.page.evaluate(() => Reflect.get(window, '__navigationResident')) !== true)
      throw new Error('Native link reloaded the document');
    if (await api.page.evaluate(() => history.length) !== before + 1) throw new Error('Arrival did not push exactly one history entry');
    api.setStep('history-back');
    await api.page.goBack({ waitUntil: 'commit' });
    await api.barrier('back', '/saturn-system/');
    api.setStep('history-forward');
    await api.page.goForward({ waitUntil: 'commit' });
    await api.barrier('forward', '/dione/');
    if (await api.page.evaluate(() => Reflect.get(window, '__navigationResident')) !== true)
      throw new Error('History traversal lost the resident document');
  },
}, {
  id: 'navigation-view-reload',
  exercises: ['capability:directLoad', 'capability:historyDeepLinks'],
  async run(api) {
    await api.load('/dione/?settings=1&shadows=on', 'deep-link');
    await api.deepLinkWitness();
    api.setStep('publish-initial-camera');
    await api.input('keydown', () => api.page.keyboard.press('Control'));
    await api.frames(12, true);
    await api.barrier('initial-camera-url', '/dione/');
    const initialToken = new URL(api.page.url()).searchParams.get('v');
    if (!initialToken) throw new Error('Initial camera URL was not published');
    const surface = await api.page.locator('.object-input-surface').boundingBox();
    if (!surface) throw new Error('Missing visible scene input surface');
    api.setStep('change-saved-camera');
    const x = surface.x + surface.width / 2, y = surface.y + surface.height / 2;
    await api.page.mouse.move(x, y);
    await api.input('pointerdown', () => api.page.mouse.down());
    for (let step = 1; step <= 8; step++) {
      await api.page.mouse.move(x + step * 7, y + step * 2);
      await api.frames(1);
    }
    await api.frames(12);
    await api.input('pointerup', () => api.page.mouse.up());
    await api.barrier('saved-camera-rest', '/dione/');
    api.setStep('publish-view');
    await api.page.keyboard.press('Control');
    await api.frames(12, true);
    await api.page.keyboard.up('Control');
    await api.barrier('view-published', '/dione/');
    const url = new URL(api.page.url());
    const token = url.searchParams.get('v');
    if (!token || token === initialToken) throw new Error('Changed camera view URL was not published');
    const before = await api.page.screenshot({ caret: 'hide' });
    // load drains DOM observations before a real document navigation.
    await api.load(url.pathname + url.search, 'reload-view');
    if (new URL(api.page.url()).searchParams.get('v') !== token) throw new Error('Reload changed the restored view token');
    await api.deepLinkWitness();
    const difference = comparePng(before, await api.page.screenshot({ caret: 'hide' }));
    if (difference) throw new Error(`Reload did not restore the saved rendered camera: ${difference.path}`);
  },
}, {
  id: 'navigation-interrupted-links',
  exercises: ['capability:directLoad',
    'handler:site:navigation:navigation-history:bindNavigationLinks:click:1'],
  async run(api) {
    await api.load('/saturn-system/', 'departure');
    await api.page.evaluate(() => { Reflect.set(window, '__navigationResident', true); });
    api.setStep('depart-dione');
    await api.page.locator('.object-information-panel a[data-object-id="dione"]').click();
    const deadline = Date.now() + 20000;
    while (await api.page.locator('.explorer-navigation-progress').getAttribute('aria-hidden') !== 'false') {
      if (Date.now() >= deadline) throw new Error('Native selection never showed pending progress');
      await api.frames(1, true);
    }
    api.setStep('interrupt-return');
    const field = api.page.locator('.object-sidebar-search');
    await field.click();
    await field.pressSequentially('Saturn');
    const result = api.page.locator('[data-catalogue-list] a[data-object-id="saturn"]');
    const resultsDeadline = Date.now() + 20000;
    while (!await result.isVisible()) {
      if (Date.now() >= resultsDeadline) throw new Error('Return search never showed Saturn');
      await api.frames(1, true);
    }
    if (await api.page.locator('.explorer-navigation-progress').getAttribute('aria-hidden') !== 'false')
      throw new Error('First navigation completed before native interruption');
    await result.click();
    await api.barrier('returned', '/saturn/');
    if (await api.page.evaluate(() => Reflect.get(window, '__navigationResident')) !== true)
      throw new Error('Interrupted links lost the resident document');
    if (await api.page.locator('.explorer-navigation-progress').getAttribute('aria-hidden') !== 'true')
      throw new Error('Interrupted return left progress pending');
  },
}, {
  id: 'navigation-search-select',
  exercises: ['capability:directLoad', 'capability:keyboard',
    'handler:site:object-browser:createObjectBrowserController:input:1',
    'handler:site:object-browser:createObjectBrowserController:keydown:2',
    'handler:site:navigation:navigation-history:bindNavigationLinks:click:1'],
  async run(api) {
    await api.load('/saturn-system/', 'departure');
    await api.page.evaluate(() => { Reflect.set(window, '__navigationResident', true); });
    const field = api.page.locator('.object-sidebar-search');
    api.setStep('type-dione');
    await field.click();
    await field.pressSequentially('Dione');
    await api.barrier('dione-result', '/saturn-system/');
    if (!await api.page.locator('[data-catalogue-list] a[data-object-id="dione"]').isVisible())
      throw new Error('Dione search result was not visible');
    api.setStep('select-keyboard');
    await api.input('keydown', () => field.press('Enter'));
    await api.barrier('arrived', '/dione/');
    if (await api.page.evaluate(() => Reflect.get(window, '__navigationResident')) !== true)
      throw new Error('Keyboard result selection reloaded the document');
  },
}, {
  id: 'navigation-browser-scroll',
  exercises: ['capability:directLoad', 'capability:wheelTrackpad',
    'handler:site:object-browser:createObjectBrowserController:scroll:1',
    'handler:site:search:catalogue-window:createCatalogueWindow:scroll:1',
    'handler:site:object-browser:createObjectBrowserController:dynamic-type:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    api.setStep('broad-query');
    const field = api.page.locator('.object-sidebar-search');
    await field.click();
    await field.pressSequentially('HD');
    await api.barrier('broad-results', '/dione/');
    const panel = api.page.locator('#object-category-results');
    if (!await panel.isVisible()) throw new Error('Search region did not open');
    const box = await panel.boundingBox();
    if (!box) throw new Error('Missing results scroll box');
    api.setStep('scroll-results');
    await api.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await api.input('wheel', () => api.page.mouse.wheel(0, 560));
    await api.frames(30, true);
    await api.barrier('scrolled', '/dione/');
    if (await panel.evaluate(node => node.scrollTop) <= 0) throw new Error('Native wheel did not scroll results');
    api.setStep('scene-dismiss');
    const surface = await api.page.locator('.object-input-surface').boundingBox();
    if (!surface) throw new Error('Missing scene input surface');
    await api.page.mouse.click(surface.x + surface.width / 2, surface.y + surface.height / 2);
    await api.barrier('dismissed', '/dione/');
    if (await panel.isVisible()) throw new Error('Scene press did not dismiss search');
  },
}, {
  id: 'navigation-category',
  exercises: ['capability:directLoad',
    'handler:site:object-browser:createObjectBrowserController:click:2',
    'handler:site:object-browser:createObjectBrowserController:keydown:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    const pill = api.page.locator('.object-search-category[data-search-query="Planets"]');
    api.setStep('category');
    await pill.click();
    await api.barrier('category-results', '/solar-system/');
    if (await pill.getAttribute('aria-pressed') !== 'true') throw new Error('Category filter did not select Planets');
    api.setStep('category-escape');
    await pill.press('Escape');
    await api.barrier('category-closed', '/solar-system/');
    if (await pill.getAttribute('aria-pressed') !== 'false') throw new Error('Category Escape did not close results');

  },
}, {
  id: 'navigation-search-retry',
  recipe: { fault: 'one find request returns HTTP 503; native Retry uses the real local server' },
  exercises: ['capability:directLoad',
    'control:site:components:ObjectResults:button:markup:1',
    'handler:site:search:search-client:createSearchClient:click:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    const field = api.page.locator('.object-sidebar-search');
    // Focus warms the real service before the bounded failed request.
    api.setStep('warm-search');
    await field.click();
    await api.barrier('warmed', '/dione/');
    let failed = false;
    await api.page.route('**/.netlify/functions/find?**', async route => {
      if (!failed && new URL(route.request().url()).searchParams.get('q') === 'dione') {
        failed = true;
        await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Journey retry transport fault' });
      } else await route.fallback();
    });
    api.setStep('failed-query');
    await field.pressSequentially('Dione');
    await api.barrier('retry-visible', '/dione/');
    const retry = api.page.locator('[data-search-retry]');
    if (!failed || !await retry.isVisible()) throw new Error('HTTP failure did not expose native Retry');
    api.setStep('retry');
    await retry.click();
    await api.barrier('retried-results', '/dione/');
    if (await retry.isVisible() || !await api.page.locator('[data-catalogue-list] a[data-object-id="dione"]').isVisible())
      throw new Error('Native Retry did not recover the query');
  },
}, {
  id: 'navigation-lifecycle',
  exercises: ['capability:directLoad',
    'handler:site:scene:scene-router:createSceneRouter:change:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    api.setStep('reduced-motion');
    await api.page.emulateMedia({ reducedMotion: 'reduce' });
    await api.barrier('preference-reduced', '/dione/');
    if (!await api.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
      throw new Error('Browser did not apply reduced-motion preference');
    api.setStep('restore-motion');
    await api.page.emulateMedia({ reducedMotion: 'no-preference' });
    await api.barrier('preference-restored', '/dione/');
    if (await api.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
      throw new Error('Browser did not restore the motion preference');
  },
}, {
  id: 'navigation-background',
  recipe: { requirement: 'native tab activation must hide the journey document; unsupported headless profiles remain experimental' },
  exercises: ['capability:directLoad',
    'handler:site:scene:scene-router:createSceneRouter:visibilitychange:1',
    'handler:site:navigation:navigation-history:createNavigationHistory:visibilitychange:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    api.setStep('background-page');
    const other = await api.page.context().newPage();
    try {
      await other.bringToFront();
      if (await api.page.evaluate(() => document.visibilityState) !== 'hidden')
        throw new Error('This headless profile cannot natively background the journey page');
      await api.page.bringToFront();
      await api.barrier('foreground-restored', '/dione/');
      if (await api.page.evaluate(() => document.visibilityState) !== 'visible')
        throw new Error('Native foreground activation did not restore visibility');
    } finally { await other.close(); }
  },
}, {
  id: 'navigation-view-input',
  exercises: ['capability:directLoad', 'capability:mouse', 'capability:keyboard',
    'handler:site:view-url-runtime:bindViewUrl:objectmotionchange:1',
    'handler:site:navigation:navigation-history:createNavigationHistory:objectmotionchange:1',
    'handler:site:navigation:navigation-history:createNavigationHistory:keydown:1',
    'handler:site:navigation:navigation-history:createNavigationHistory:pointerleave:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    api.setStep('publish-departure');
    await api.input('keydown', () => api.page.keyboard.press('Control'));
    await api.frames(12, true);
    const before = new URL(api.page.url()).searchParams.get('v');
    const length = await api.page.evaluate(() => history.length);
    if (!before) throw new Error('Initial camera did not publish a view token');
    const box = await api.page.locator('.object-input-surface').boundingBox();
    if (!box) throw new Error('Missing visible scene input surface');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    api.setStep('camera-drag');
    await api.page.mouse.move(x, y);
    await api.input('pointerdown', () => api.page.mouse.down());
    for (let step = 1; step <= 8; step++) {
      await api.page.mouse.move(x + step * 8, y + step * 2);
      await api.frames(1);
    }
    await api.frames(12);
    await api.input('pointerup', () => api.page.mouse.up());
    await api.barrier('camera-rest', '/dione/');
    api.setStep('leave-content');
    await api.page.mouse.move(-10, -10);
    await api.barrier('view-address', '/dione/');
    const after = new URL(api.page.url()).searchParams.get('v');
    if (!after || after === before) throw new Error('Native drag and pointer leave did not publish the changed camera');
    if (await api.page.evaluate(() => history.length) !== length) throw new Error('Camera view created a navigation entry');
  },
}, {
  id: 'navigation-programmatic-submit',
  recipe: { exception: 'Enter and category clicks prevent native form submission; the only submit button is hidden. requestSubmit reaches the otherwise unreachable submit listener without clicking a hidden control.' },
  exercises: ['capability:directLoad',
    'handler:site:object-browser:createObjectBrowserController:submit:1'],
  async run(api) {
    await api.load('/dione/', 'direct');
    const field = api.page.locator('.object-sidebar-search');
    api.setStep('prepare-query');
    await field.click();
    await field.pressSequentially('Dione');
    await api.barrier('query-results', '/dione/');
    await field.press('Escape');
    await api.barrier('query-closed', '/dione/');
    const result = api.page.locator('[data-catalogue-list] a[data-object-id="dione"]');
    if (await result.isVisible()) throw new Error('Escape did not close the query before submit');
    api.setStep('programmatic-submit');
    // Explicit exception: source audit found no visible browser-input route to this handler.
    await api.page.locator('.object-sidebar-search-card').evaluate(form => {
      if (!(form instanceof HTMLFormElement)) throw new Error('Missing native search form');
      form.requestSubmit();
    });
    await api.barrier('submitted-query', '/dione/');
    if (!await result.isVisible()) throw new Error('Form submit did not restore search results');
  },
}, {
  id: 'navigation-world-intent',
  exercises: ['capability:directLoad',
    'handler:site:navigation:navigation-fragments:bindNavigationIntent:objecthoverchange:1'],
  async run(api) {
    await api.load('/saturn-system/', 'direct');
    // Captions paint in a pseudo-element on a zero-size leaf. The marker owns
    // the actual 16px ring and the stage pick target; hover its visible centre.
    const marker = api.page.locator('[data-context-body="iapetus"][data-context-indicator-visible="true"]');
    if (!await marker.isVisible() || !await marker.evaluate(node => {
      const style = getComputedStyle(node, '::before');
      return style.visibility === 'visible' && Number(style.opacity) > 0;
    })) throw new Error('Iapetus world marker is not painted');
    const box = await marker.boundingBox();
    if (!box) throw new Error('Iapetus world marker has no screen box');
    api.setStep('world-hover');
    await api.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await api.frames(20, true);
    if (!await api.page.locator('[data-object-hovered="true"][data-object-navigate="iapetus"]').count())
      throw new Error('Native pointer did not pick the visible Iapetus marker');
    await api.barrier('intent-prefetched', '/saturn-system/');
    api.setStep('leave-world-label');
    await api.page.mouse.move(1100, 740);
    await api.barrier('hover-cleared', '/saturn-system/');
    if (await api.page.locator('[data-object-hovered="true"][data-object-navigate="iapetus"]').count())
      throw new Error('Native pointer leave retained the Iapetus hover');
  },
}];

// These paths share Dione's retained shell. Keep all observations in one
// document, and bind qualification to every reused action recipe.
const retainedIds = ['navigation-search', 'navigation-browser-scroll', 'navigation-search-retry',
  'navigation-lifecycle', 'navigation-view-input', 'navigation-programmatic-submit'];
const retainedPaths = retainedIds.map(id => {
  const path = journeys.find(journey => journey.id === id);
  if (!path) throw new Error(`Missing retained navigation path ${id}`);
  return path;
});
journeys.push({
  id: 'navigation-retained-controls',
  recipe: { paths: retainedPaths.map(path => ({ id: path.id, run: String(path.run), recipe: path.recipe ?? null })) },
  exercises: [...new Set(retainedPaths.flatMap(path => path.exercises))],
  async run(api) {
    await api.load('/dione/', 'direct');
    for (const path of retainedPaths) {
      const field = api.page.locator('.object-sidebar-search');
      if (await field.inputValue() !== '') {
        api.setStep(path.id + '-reset-query');
        await field.click();
        await api.page.locator('.object-sidebar-search-clear').click();
        await api.barrier(path.id + '-reset-query', '/dione/');
      }
      await path.run({ ...api,
        setStep: name => api.setStep(path.id + '-' + name),
        barrier: (name, route) => api.barrier(path.id + '-' + name, route),
        load: async (url, name) => {
          if (url !== '/dione/') throw new Error('Retained path attempted document navigation');
          await api.barrier(path.id + '-' + name, '/dione/');
          return null;
        },
      });
    }
  },
});

journeys.push({
  id: 'navigation-world-select',
  exercises: ['capability:directLoad',
    'handler:site:navigation:navigation-history:bindNavigationLinks:objectnavigate:1'],
  async run(api) {
    await api.load('/saturn-system/', 'departure');
    await api.page.evaluate(() => { Reflect.set(window, '__navigationResident', true); });
    const marker = api.page.locator('[data-context-body="iapetus"][data-context-indicator-visible="true"]');
    if (!await marker.isVisible() || !await marker.evaluate(node => {
      const style = getComputedStyle(node, '::before');
      return style.visibility === 'visible' && Number(style.opacity) > 0;
    })) throw new Error('Iapetus selection marker is not painted');
    const box = await marker.boundingBox();
    if (!box) throw new Error('Iapetus selection marker has no screen box');
    api.setStep('marker-intent');
    await api.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await api.frames(20, true);
    if (!await api.page.locator('[data-object-hovered="true"][data-object-navigate="iapetus"]').count())
      throw new Error('Native pointer did not pick the Iapetus selection marker');
    await api.barrier('marker-prefetched', '/saturn-system/');
    api.setStep('marker-select');
    await api.input('pointerdown', () => api.page.mouse.down());
    await api.input('pointerup', () => api.page.mouse.up());
    await api.barrier('marker-arrival', '/iapetus/');
    if (await api.page.evaluate(() => Reflect.get(window, '__navigationResident')) !== true)
      throw new Error('World marker selection reloaded the document');
  },
});

