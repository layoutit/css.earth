async page => {
  const context = await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:1440,height:900}});
  const native = await context.newPage();
  const results=[];
  for (const [label,port] of [['before',4390],['after',4389]]) {
    const response = await native.goto(`http://127.0.0.1:${port}/earth/?overview=system`);
    await native.waitForLoadState('networkidle');
    results.push({label,status:response.status(),...(await native.evaluate(() => ({contextHidden:document.querySelector('.object-context')?.hidden,header:document.querySelector('[data-system-current]')?.getAttribute('data-system-header'),solarFactsHidden:document.querySelector('[data-solar-system-facts]')?.hidden,title:document.querySelector('[data-system-current] .object-title')?.textContent,source:document.querySelector('[data-source-link]')?.getAttribute('href')})))});
    await native.screenshot({path:`/Users/ekrof/Documents/Codex/2026-09-23/im-x20/work/css-earth-report-cleanup/output/playwright/selection-presentation/${label}-native-system.png`});
  }
  await context.close();
  return results;
}
