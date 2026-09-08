import {chromium} from 'playwright';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),origin='http://127.0.0.1:4210';
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
 const browser=await launch(options),newPage=browser.newPage.bind(browser);
 browser.newPage=async options=>{
  const page=await newPage({...options,serviceWorkers:'block'});
  await page.route(origin+'/**',async route=>{
   const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
   let path=resolve(root,'.'+pathname);
   if(!path.startsWith(root+'/'))return route.fulfill({status:400,body:'Invalid path'});
   try{
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    const body=await readFile(path);
    await route.fulfill({status:200,body,contentType:mime[extname(path)]??'application/octet-stream'});
   }catch(error){console.error('Built asset failed:',path,error.message);await route.fulfill({status:404,body:'Missing built asset'});}
  });
  return page;
 };
 return browser;
};
console.log('Built-artifact browser run: first-party requests are fulfilled from dist; this is not a production network measurement.');
