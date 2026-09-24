async page => {
  const browser = page.context().browser(), results = [];
  const directory = '/Users/ekrof/Documents/Codex/2026-09-23/im-x20/output/playwright/search-presentation';
  for (const [label, port] of [['before',4390],['after',4389]]) {
    const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:900}});
    try {
      const native = await context.newPage();
      for (const [view, query] of [['native-search','earth'],['native-empty','']]) {
        await native.goto(`http://127.0.0.1:${port}/earth/?q=${query}`);
        await native.waitForLoadState('networkidle');
        await native.screenshot({path:`${directory}/${label}-${view}.png`});
        results.push({label,view,rows:await native.locator('.object-item:not([hidden])').count(),treeHidden:await native.locator('[data-object-navigation-tree]').getAttribute('hidden')!==null});
      }
    } finally { await context.close(); }
    await page.goto(`http://127.0.0.1:${port}/earth/?feature=city-3435910`);
    await page.waitForFunction(()=>window.__cssEarth?.ready && window.__cssEarth.mountedObjectCount===1);
    const city = page.locator('.object-destination-panel');
    await city.waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('.object-destination-panel').getAttribute('aria-busy')==='false');
    const title = await page.locator('.object-destination-name').textContent();
    await page.getByRole('button',{name:'Browse celestial objects',exact:true}).click();
    if (await city.isVisible()) throw Error(`${label}: search failed to hide city`);
    await page.getByRole('searchbox',{name:'Search celestial objects...'}).press('Escape');
    await city.waitFor({state:'visible'});
    const sameTitle = await page.locator('.object-destination-name').textContent();
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:`${directory}/${label}-city.png`});
    results.push({label,view:'city',title,restored:sameTitle===title});
  }
  return results;
}
