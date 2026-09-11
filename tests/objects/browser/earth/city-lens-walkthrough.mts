import type { publishObjectDiagnostics } from '../../../../src/renderers/css/runtime/object-diagnostics.ts';
type EarthDiagnostics = ReturnType<typeof publishObjectDiagnostics>;
type PagingState = ReturnType<EarthDiagnostics['runtime']['pages']>[string];
type CameraState = ReturnType<EarthDiagnostics['camera']['state']>;
declare global { interface Window { __walkthroughNodes: HTMLElement[]; } }
type WalkthroughReport = { base: string; browser: string; output: string; cache: string; errors: string[]; checkpoints: { name: string; path: string; camera: CameraState }[]; final?: { city: PagingState; noise: PagingState; stable: boolean; sameNodes: boolean }; passed?: boolean; video?: string };
import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";

const base=(process.argv.slice(2).find(argument=>/^https?:\/\//u.test(argument))??"http://127.0.0.1:4210").replace(/\/$/u,"");
const output=new URL(`../../../../output/playwright/city-lens-walkthrough-${Date.now()}/`,import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const report: WalkthroughReport={base,browser:browser.version(),output:output.pathname,cache:"fresh isolated browser context",errors:[],checkpoints:[]};
let context: BrowserContext | undefined, page: Page | undefined;
try{
  context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:1,
    recordVideo:{dir:output.pathname,size:{width:1400,height:1000}}});
  page=await context.newPage();page.on("pageerror",error=>report.errors.push(error.message));
  const checkpoint=async (name: string)=>{
    assert.ok(page);
    const path=new URL(`${name}.png`,output).pathname;await page.screenshot({path});
    report.checkpoints.push({name,path,camera:await page.evaluate(()=>{
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).camera.state(); })});
  };
  const settle=async (noise: boolean)=>{
    assert.ok(page);
    await page.waitForFunction(()=>{
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return !requiredDiagnostics(window.__earth).camera.stats().dragInertia.destinationFlyTo.active; });
    await page.waitForFunction(noise=>{
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

      const s=requiredDiagnostics(window.__earth).runtime.pages()[noise ? "noise" : "city"];
      return s.desired.length>0&&!s.pendingSelection&&!s.activeLoads&&!s.index.activeLoads&&
        s.desired.every(key=>s.retained.some(p=>p.key===key&&p.published));
    },noise,{timeout:120000});
  };
  await page.goto(`${base}/earth/`);await page.waitForFunction(()=>window.__earth?.ready);
  await page.evaluate(()=>{
    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
    function requiredInput(value: Element | null): HTMLInputElement { if (!(value instanceof HTMLInputElement)) throw new Error("Expected required HTMLInputElement"); return value; }
{ const motion = requiredInput(document.querySelector('input[name="motion"]')); if (motion.checked) motion.click(); }window.__walkthroughNodes=[...requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*")];});
  await checkpoint("01-globe");await page.waitForTimeout(1000);
  await page.locator(".planet-sidebar-search").fill("Buenos Aires");
  const destination=page.getByRole("button",{name:"Buenos Aires, Buenos Aires F.D., Argentina",exact:true});
  await destination.waitFor();await checkpoint("02-search");await page.waitForTimeout(800);
  await destination.click();await settle(false);await checkpoint("03-city");await page.waitForTimeout(1300);
  const noiseButton=page.locator('button[name="lens"][value="buenos-aires-noise"]');
  assert.ok(await noiseButton.isVisible(),"City selection must keep surface lenses reachable");
  await noiseButton.click();await settle(true);
  assert.equal(await noiseButton.getAttribute("aria-pressed"),"true");
  assert.ok(await page.locator('[data-lens-legend="buenos-aires-noise"]').isVisible());
  await checkpoint("04-noise");await page.waitForTimeout(2200);
  await page.mouse.move(1020,530);await page.mouse.wheel(0,-100);await settle(false);await settle(true);
  await checkpoint("05-noise-detail");await page.waitForTimeout(2000);
  report.final=await page.evaluate(()=>{
    function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return ({city:requiredDiagnostics(window.__earth).runtime.pages().city,noise:requiredDiagnostics(window.__earth).runtime.pages().noise,
    stable:requiredDiagnostics(window.__earth).assertStableDomIdentity(),sameNodes:[...requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*")].every((n,i)=>n===window.__walkthroughNodes[i])}); });
  assert.ok(report.final.stable&&report.final.sameNodes);
  assert.deepEqual(report.final.city.errors,[]);assert.deepEqual(report.final.city.index.errors,[]);assert.deepEqual(report.final.noise.errors,[]);
  assert.deepEqual(report.errors,[]);report.passed=true;
}finally{
  await context?.close();report.video=await page?.video()?.path();await browser.close();
  await writeFile(new URL("report.json",output),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output:output.pathname,passed:report.passed??false,video:report.video}));
}
