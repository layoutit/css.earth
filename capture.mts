async page => {
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width:1440,height:900});
  const state = () => page.evaluate(() => ({
    ready:window.__cssEarth?.ready, mounted:window.__cssEarth?.mountedObjectCount,
    error:window.__cssEarth?.error, selection:document.documentElement.dataset.selection,
    browser:document.querySelector('.object-browser').hidden,
    selected:document.querySelector('.object-selected-content').hidden,
    tree:document.querySelector('[data-object-navigation-tree]').hidden,
    empty:document.querySelector('.object-empty').hidden,
    features:document.querySelector('.object-feature-results').hidden,
    featureNames:[...document.querySelectorAll('.object-feature-results li:not([hidden]) .object-destination-result-name')].map(el=>el.textContent),
    category:[...document.querySelectorAll('.object-search-category[aria-pressed="true"]')].map(el=>el.textContent.trim()),
    query:document.querySelector('.object-sidebar-search').value,
  }));
  for (const [label, port] of [['before',4390],['after',4389]]) {
    const shot = async view => {
      await page.waitForLoadState('networkidle');
      await page.locator('.object-search-browser-caret').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
      const current = await state();
      if (!current.ready || current.mounted !== 1 || current.error) throw Error(JSON.stringify(current));
      await page.screenshot({path:`output/playwright/search-presentation/${label}-${view}.png`});
      results.push({label,view,...current});
    };
    await page.goto(`http://127.0.0.1:${port}/earth/?v=UMJA3puvFbeOAUFCxzNAAAAAv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAA`);
    await page.waitForFunction(()=>window.__cssEarth?.ready && window.__cssEarth.mountedObjectCount===1);
    await shot('earth');
    await page.getByRole('button',{name:'Browse celestial objects',exact:true}).click();
    await shot('tree');
    const search = page.getByRole('searchbox',{name:'Search celestial objects...'});
    const found = page.waitForResponse(r=>r.url().includes('/.netlify/functions/find?') && r.url().includes('q=earth'));
    await search.fill('Earth'); await found;
    await page.locator('.object-feature-results:not([hidden])').waitFor();
    await shot('search');
    await search.press('Escape');
    await shot('closed');
    await page.getByRole('button',{name:'Browse celestial objects',exact:true}).click();
    await page.locator('.object-item:not([hidden]) .object-link.is-active').waitFor();
    await search.fill('');
    await shot('cleared');
    await page.getByRole('button',{name:'Planets',exact:true}).click();
    await shot('planets');
    const none = page.waitForResponse(r=>r.url().includes('/.netlify/functions/find?') && r.url().includes('q=zzzzzzzz'));
    await search.fill('zzzzzzzz'); await none;
    await page.locator('.object-empty:not([hidden])').waitFor();
    await shot('empty');
  }
  if (errors.length) throw Error(JSON.stringify(errors));
  return {browser:page.context().browser().version(),viewport:page.viewportSize(),results,errors};
}
