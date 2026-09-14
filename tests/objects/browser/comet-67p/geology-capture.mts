declare global { interface Window { __geologyProof: { body: Element; nodes: Element[]; camera: string }; } }
import type { Page } from 'playwright';
// Reusable Playwright capture; pass an open local 67P page to the default export.
export default async (page: Page,{screenshotPrefix='67p-geology',dprs=[1,2]}: { screenshotPrefix?: string; dprs?: readonly number[] }={}) => {
  const url=await page.url();
  if(!/^http:\/\/127\.0\.0\.1:\d+\/comet-67p\/(?:[?#]|$)/.test(url))throw new Error('Open the local 67P route first.');
  const browser=page.context().browser(),reports=[];
  if (!browser) throw new Error("Capture requires a connected browser");
  for(const dpr of dprs){
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
    const p=await context.newPage(),errors: string[]=[],requests: string[]=[],preparedResponses: { url: string; bytes: number[] }[]=[],pending: Promise<unknown>[]=[];
    const cdp=await context.newCDPSession(p);
    await cdp.send('Network.enable',{maxTotalBufferSize:268435456,maxResourceBufferSize:134217728});
    p.on('pageerror',e=>errors.push(e.message));context.on('request',r=>requests.push(r.url()));
    context.on('response',r=>{
      if(r.status()>=400)errors.push(r.status()+' '+r.url());
      if(/\/object\.[^/]+\.json$/.test(r.url()))pending.push((async()=>preparedResponses.push({url:r.url(),bytes:[...await r.body()]}))());
    });
    try{
      await p.goto(url,{waitUntil:'networkidle'});
      await p.waitForFunction(()=>document.documentElement.dataset.ready==='true'&&document.querySelectorAll<HTMLElement>('.comet-67p-body > u').length===1000);
      await p.locator('label').filter({hasText:'Shadows'}).count();
      const settings=p.getByRole('button',{name:'Settings',exact:true});
      const shadows=async (checked: boolean)=>{
        await settings.click();const control=p.locator('input[name="shadows"]');
        if(await control.isChecked()!==checked)await p.locator('label').filter({hasText:'Shadows'}).click();
        await p.keyboard.press('Escape');await p.waitForLoadState('networkidle');
      };
      await shadows(false);
      await p.locator('.comet-67p-body').evaluate(body=>{
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
window.__geologyProof={body,nodes:[...body.children],camera:requiredElement(document.querySelector('.polycss-scene')).style.transform};});
      const views=[];
      for(const id of ['regions','geology']){
        await p.locator(`button[name="dataset"][value="${id}"]`).click();
        await p.waitForFunction(id=>{
          function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return requiredElement(document.querySelector('.planet-stage')).dataset.lens===id; },id);
        await p.waitForLoadState('networkidle');
        const panel=p.locator(`[data-lens-details="${id}"]`);
        const facts=await panel.locator('.planet-facts > li').allTextContents();
        if(facts.length!==2)throw new Error('Expected concise facts for '+id);
        const description=await panel.locator('.planet-lens-details-copy').innerText();
        const legend=p.locator(`[data-lens-legend="${id}"]`);
        const categories=await legend.locator('.planet-lens-legend-category-label').allTextContents();
        if(categories.length!==(id==='regions'?26:13))throw new Error('Incomplete category legend.');
        // The existing sidebar scroll contains the complete legend.
        await legend.locator('li').last().scrollIntoViewIfNeeded();
        if(!await legend.locator('li').last().isVisible())throw new Error('Last legend row inaccessible.');
        await panel.locator('h3').scrollIntoViewIfNeeded();
        for(const mode of ['flood','shadows']){
          await shadows(mode==='shadows');
          await p.waitForFunction(({id,mode})=>[...document.querySelectorAll<HTMLElement>('.comet-67p-body > u')].every(n=>getComputedStyle(n).backgroundImage.includes(`comet-67p-${id}-${mode==='flood'?'surface':'shadow'}@2x.webp`)),{id,mode});
          const state=await p.locator('.comet-67p-body').evaluate(async(body,{id,mode})=>{
            function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

            const nodes=[...body.children],probe=window.__geologyProof;
            if(body!==probe.body||nodes.some((n,i)=>n!==probe.nodes[i]))throw new Error('Scene nodes replaced.');
            if(requiredElement(document.querySelector('.polycss-scene')).style.transform!==probe.camera)throw new Error('Dataset switch moved the camera.');
            const urls=[...new Set(nodes.map(n=>getComputedStyle(n).backgroundImage.match(/url\("?([^"\)]+)/)?.[1]))];
            const atlases=await Promise.all(urls.map(async url=>{if (!url) throw new Error("Missing retained atlas URL"); const response=await fetch(url),bytes=await response.arrayBuffer();if(!response.ok)throw new Error('Atlas failed');return{url,bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')};}));
            if(!atlases.every(a=>a.url.endsWith(`comet-67p-${id}-${mode==='flood'?'surface':'shadow'}@2x.webp`)))throw new Error('Wrong atlas selected: '+JSON.stringify({id,mode,atlases}));
            const forbiddenStyles=nodes.some(n=>{const s=getComputedStyle(n);return s.clipPath!=='none'||s.maskImage!=='none'||s.filter!=='none'||s.mixBlendMode!=='normal'||/gradient\(/.test(s.backgroundImage)});
            return{retained:true,leaves:nodes.length,atlases,sceneCount:document.querySelectorAll<HTMLElement>('.polycss-scene').length,forbidden:body.querySelectorAll<HTMLElement>('canvas,svg').length,forbiddenStyles};
          },{id,mode});
          const screenshot=`output/playwright/${screenshotPrefix}-dpr${dpr}-${id}-${mode}.png`;
          await p.screenshot({path:screenshot});views.push({id,mode,screenshot,facts,description,categories,...state});
        }
        await shadows(false);
      }
      const forbiddenRequests=requests.filter(url=>/\.(?:vtk|xml|tsv|mat)(?:\?|$)|source-index\.json/.test(url));
      if(errors.length||forbiddenRequests.length||views.some(v=>v.leaves!==1000||v.sceneCount!==1||v.forbidden||v.forbiddenStyles))throw new Error(JSON.stringify({errors,forbiddenRequests,views}));
      await Promise.all(pending);
      const transportedPrepared=await p.evaluate(async responses=>Promise.all(responses.map(async r=>({url:r.url,bytes:r.bytes.length,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(r.bytes)))].map(n=>n.toString(16).padStart(2,'0')).join('')}))),preparedResponses);
      reports.push({dpr,browser:browser.version(),url,views,transportedPrepared,errors,forbiddenRequests});
    }finally{await context.close();}
  }
  return reports;
}
