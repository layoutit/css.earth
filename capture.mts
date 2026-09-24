async page => {
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [label, port] of [['after',4389],['before',4390]]) {
    await page.goto(`http://127.0.0.1:${port}/earth/?v=UMJA3puvFbeOAUFCxzNAAAAAv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAA`);
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssEarth.mountedObjectCount === 1);
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:`output/playwright/selection-presentation/${label}-earth.png`});
    await page.getByRole('button',{name:'Browse celestial objects',exact:true}).click();
    await page.locator('.object-search-browser-caret').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:`output/playwright/selection-presentation/${label}-tree.png`});
    const find = page.waitForResponse(r=>r.url().includes('/.netlify/functions/find?') && r.url().includes('q=earth'));
    await page.getByRole('searchbox',{name:'Search celestial objects...'}).fill('Earth');
    await find;
    await page.locator('.object-feature-results:not([hidden])').waitFor();
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:`output/playwright/selection-presentation/${label}-search.png`});
    const state = await page.evaluate(() => ({selected:document.documentElement.dataset.selection, active:[...document.querySelectorAll('.object-link.is-active')].map(el=>el.dataset.objectId), features:document.querySelector('.object-feature-results .object-panel-heading-count')?.textContent, ready:window.__cssEarth.ready, mounted:window.__cssEarth.mountedObjectCount, error:window.__cssEarth.error}));
    await page.getByRole('searchbox',{name:'Search celestial objects...'}).press('Escape');
    await page.getByRole('button',{name:'Browse celestial objects',exact:true}).click();
    await page.locator('.object-item:not([hidden]) .object-link.is-active').waitFor();
    results.push({label,...state,reopened:true});
  }
  return {results,errors,browser:page.context().browser().version()};
}
